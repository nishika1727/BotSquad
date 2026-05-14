import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from llama_index.core import StorageContext, load_index_from_storage
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

from groq import Groq
import chromadb
from sentence_transformers import CrossEncoder
from intent_links import intent_to_url


# ---------------------------
# 🔥 LOAD MULTIPLE API KEYS
# ---------------------------
load_dotenv()

GROQ_KEYS_RAW = os.getenv("GROQ_API_KEYS", "")
GROQ_API_KEYS = [k.strip() for k in GROQ_KEYS_RAW.split(",") if k.strip()]

if not GROQ_API_KEYS:
    raise Exception("❌ No GROQ_API_KEYS found in .env file!")

current_key_index = -1


def get_next_groq_key():
    """ Round-robin rotation """
    global current_key_index
    current_key_index = (current_key_index + 1) % len(GROQ_API_KEYS)
    return GROQ_API_KEYS[current_key_index]


# ------------------------------------
# 🔥 Initialize LLM using rotating key
# ------------------------------------
def init_llm():
    api_key = get_next_groq_key()
    print(f"🔑 Using GROQ Key: {api_key[:6]}*****")

    return Groq(api_key=api_key)


# ---------------------------
# RAG COMPONENT INITIALIZERS
# ---------------------------
def init_embed_model():
    return HuggingFaceEmbedding("sentence-transformers/all-MiniLM-L6-v2")


def init_reranker():
    return CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")


def init_vector_store(persist_dir="./chroma_db", collection_name="rag-collection"):
    client = chromadb.PersistentClient(path=persist_dir)
    coll = client.get_or_create_collection(collection_name)
    return ChromaVectorStore(chroma_collection=coll)


def load_index(persist_dir="./chroma_db", index_dir="./index", embed_model=None, vector_store=None):
    sc = StorageContext.from_defaults(
        persist_dir=index_dir,
        vector_store=vector_store
    )
    return load_index_from_storage(sc, embed_model=embed_model)


def initialize_pipeline():
    embed = init_embed_model()
    store = init_vector_store()
    llm_client = init_llm()
    index = load_index(embed_model=embed, vector_store=store)
    reranker = init_reranker()

    return {
        "llm": llm_client,
        "embed_model": embed,
        "vector_store": store,
        "index": index,
        "reranker": reranker
    }


pipeline = initialize_pipeline()
print("✅ Pipeline initialized successfully.")


# ---------------------------
# GROQ GENERATION FUNCTION
# ---------------------------
def groq_generate(llm, prompt):
    try:
        response = llm.chat.completions.create(
            model="llama3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1
        )
        return response.choices[0].message["content"]

    except Exception as e:
        print("⚠️ GROQ error:", e)

        # fallback: try next API key
        print("🔄 Switching API Key...")
        new_llm = init_llm()

        response = new_llm.chat.completions.create(
            model="llama3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1
        )
        return response.choices[0].message["content"]


# ---------------------------
# SESSION HANDLING
# ---------------------------
session = {
    "original_query": None,
    "expecting_clarification": False
}


# ---------------------------
# MAIN ANSWER GENERATOR
# ---------------------------
def generate_answer(query, pipeline):

    llm = pipeline["llm"]
    index = pipeline["index"]

    vague_keywords = ["fee", "admission", "form", "hostel", "apply", "scholarship", "process"]

    if session["expecting_clarification"] and session["original_query"]:
        query = f"{session['original_query']} for {query}"
        session["original_query"] = None
        session["expecting_clarification"] = False

    elif any(k in query.lower() for k in vague_keywords):
        session["original_query"] = query
        session["expecting_clarification"] = True

    retriever = index.as_retriever(similarity_top_k=3)
    context = "\n\n---\n\n".join(node.get_content() for node in retriever.retrieve(query))

    # Prompt preserved as-is (your rules)
    prompt = f"""
You are PU-Assistant, the official AI helpdesk chatbot of Panjab University, Chandigarh.

You must answer the student's query *strictly* using the verified information provided below in the context.
 Never use your own knowledge, never guess, and never add anything not explicitly present in the context.

Answering Rules (apply exactly as written):
1. If the question is about eligibility, admission steps, rules, process, fees, or forms:
   → Answer clearly using neat bullet points (maximum 4–6 points).
2. For simple factual or definition-style questions:
   → Reply in one direct, precise sentence.
3. If any web page, downloadable form, or PDF is mentioned in the context:
   → → Include it in the response as a clickable markdown link, but *always* use the exact text given by the system later (e.g., "📄 Download official fee PDF here" or "🌐 Visit official admission portal"). Never write “Visit official page” or “Visit official website” yourself.
   → Only include links that are clearly found in the context.
4. All links must open in a new browser tab.
5. Never guess, assume, or generate a URL or link that is not found in the context.
6. If both ₹ (INR) and $ (USD) are mentioned:
   → Mention only the ₹ (INR) amount in the answer.
7. If the required information is not found in the context:
   → Respond politely with exactly one of these:
   > Sorry, I couldn't find that information. Please contact the university administration.  
   or  
   > Sorry, I couldn't help you with that. Please check the official website.
8. Never mention words like “context not available”, “data not found”, or anything about missing data.
9. Maintain a formal, professional, and polite tone throughout.
10. Avoid repetition and unnecessary introductions.
11. IMPORTANT: Always answer using exactly the same bullet titles, same order, and same style every time this question is asked — so repeated questions get the same answer.
12. Strictly answer only from the "Verified Information" context below.
13. If required details (like exam name, eligibility, process) are present in context, you *must* include them.
14. Do *NOT* add any information not present in context.
15. You must answer strictly about the admission process only, if that's what is asked.
16. Ignore fee, hostel, scholarships, or anything else even if present in context, unless specifically asked.
17. If the user's question contains an unclear, misspelled, or unknown word (e.g., "stuce") and you don't know its meaning, do NOT guess.
    → Instead, politely ask:
    > Sorry, could you please clarify what you meant by "stuce"?
18. If same question is asked again, answer exactly the same as before, unless context changed.

Smart Clarification Logic (very important):
- If the student's question is vague, generic, incomplete, or broad (e.g., “fee structure”, “course”, “apply”, “form”, “hostel”, “scholarship”, etc.):
   → DO NOT answer immediately.
   → Politely ask the user to clarify by giving 2–3 relevant options based on the topic.
   → Format exactly like:
     > Could you please clarify which of the following you're referring to?  
     > - Option 1  
     > - Option 2  
     > - Option 3
- Examples:
   - For “fee structure”, ask:
     > Could you please clarify which of the following departments you're referring to regarding the fee structure?  
     > - University Institute of Engineering & Technology (UIET)  
     > - Department of Law  
     > - Department of Computer Science & Applications
   - For “hostel”, ask:
     > Are you referring to:  
     > - Boys’ hostels  
     > - Girls’ hostels  
     > - International student hostels
   - For “scholarship”, ask:
     > Are you asking about:  
     > - Need-based scholarships  
     > - Merit scholarships  
     > - Reserved category benefits
- Never explain why you're asking — just ask directly and wait for student's reply.

Follow-Up Suggestions (only after giving a complete answer):
- Suggest exactly three related questions about Panjab University admissions, fees, scholarships, hostels, or campus life.
- Do not repeat the same topic as the user's original question.
- Each follow-up question must be short (max 5–6 words).
- Do not reuse the same theme twice.
- Format strictly like this:
 Know more about:
 - Question 1  
 - Question 2  
 - Question 3

*Use only this verified information to answer:*
{context}

*Student’s Question:*
{query}

*Your Answer:*
""".strip()

    try:
        reply = groq_generate(llm, prompt)

    except Exception as e:
        print("❌ Fatal Groq Error:", e)
        return {
            "reply": "⚠️ Server error, please try again later.",
            "follow_ups": []
        }

    return {
        "reply": reply,
        "follow_ups": ["Scholarships", "Hostels", "Campus Life"]
    }


# ---------------------------
# FLASK ROUTES
# ---------------------------
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    query = data.get("message", "")
    result = generate_answer(query, pipeline)
    return jsonify(result)


@app.route("/files/<path:filename>")
def download_file(filename):
    return send_from_directory("static", filename)


@app.route("/healthz")
def health():
    return "OK", 200


if __name__ == "__main__":
    app.run(port=5000, host="0.0.0.0", debug=True)
