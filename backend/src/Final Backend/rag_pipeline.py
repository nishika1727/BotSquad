import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
from llama_index.core import StorageContext, load_index_from_storage
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.llms.groq import Groq
from chromadb import PersistentClient
from llama_index.llms.base import ChatMessage, MessageRole

# Load environment variables
load_dotenv()

# Flask App Setup
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "supersecretkey")
CORS(app, supports_credentials=True)

# LLM and Embedding Model Setup
llm = Groq(model="mixtral-8x7b-32768", api_key=os.getenv("GROQ_API_KEY"))
embed_model = HuggingFaceEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")

# Chroma Vector Store Setup
db = PersistentClient(path="./chroma_db")
chroma_collection = db.get_or_create_collection("pu_docs")
vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
storage_context = StorageContext.from_defaults(vector_store=vector_store)
index = load_index_from_storage(storage_context, embed_model=embed_model)

# Intent → Link Mapping
intent_to_url = {
    "admission": {
        "keywords": ["admission", "apply", "application"],
        "urls": ["https://admissions.puchd.ac.in"]
    },
    "prospectus": {
        "keywords": ["prospectus"],
        "urls": ["https://admissions.puchd.ac.in/includes/admnpros2024.pdf"]
    },
    "hostel": {
        "keywords": ["hostel"],
        "urls": ["https://puchd.ac.in/facilities/hostel"]
    },
    "fee": {
        "keywords": ["fee", "fees"],
        "urls": ["https://dui.puchd.ac.in/syllabus.php"]
    }
}

pipeline = {"llm": llm, "index": index}

# ---------------------------
# Main Answer Generator
# ---------------------------
def generate_answer(query, pipeline):
    llm = pipeline["llm"]
    index = pipeline["index"]

    vague_keywords = ["fee", "admission", "form", "hostel", "apply", "scholarship", "process"]

    if session.get("expecting_clarification") and session.get("original_query"):
        query = f"{session['original_query']} for {query}"
        session["original_query"] = None
        session["expecting_clarification"] = False
    elif any(keyword in query.lower() for keyword in vague_keywords):
        session["original_query"] = query
        session["expecting_clarification"] = True

    # Retrieve top 3 similar chunks
    retriever = index.as_retriever(similarity_top_k=3)
    context = "\n\n---\n\n".join(node.get_content() for node in retriever.retrieve(query))

    # Final Prompt to LLM
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

    response = llm.chat(messages=[
        ChatMessage(role=MessageRole.SYSTEM, content="You are a helpful assistant."),
        ChatMessage(role=MessageRole.USER, content=prompt)
    ])

    full_text = response.message.content.strip()
    answer_main = full_text
    follow_ups = []

    if "Know more about:" in full_text:
        parts = full_text.split("Know more about:")
        answer_main = parts[0].strip()
        follow_lines = parts[1].strip().splitlines()
        follow_ups = [line.replace("-", "").strip() for line in follow_lines if line.strip()]

    query_lower = query.lower()
    friendly_label = None
    pdf_url = None
    detected_link = None

    for intent, data in intent_to_url.items():
        keywords = data.get("keywords", [])
        urls = data.get("urls", [])
        if any(keyword in query_lower for keyword in keywords):
            detected_link = urls[0] if isinstance(urls, list) else urls
            break

    if "fee" in query_lower and "pdf" not in answer_main.lower():
        pdf_url = "http://127.0.0.1:5000/files/pu_fee_structure.pdf"
        friendly_label = f"\n\n📄 [Download official fee PDF here]({pdf_url})"
    elif detected_link and detected_link not in answer_main:
        if "admission" in query_lower or "apply" in query_lower:
            friendly_label = f"\n\n🔗 [Apply here]({detected_link})"
        elif "prospectus" in query_lower:
            friendly_label = f"\n\n📄 [View official prospectus]({detected_link})"
        elif "hostel" in query_lower:
            friendly_label = f"\n\n🏨 [Hostel Info]({detected_link})"

    return {
        "answer": answer_main,
        "follow_ups": follow_ups,
        "pdf_url": pdf_url,
        "link": friendly_label
    }

# ---------------------------
# API Routes
# ---------------------------

@app.route("/query", methods=["POST"])
def query():
    data = request.get_json()
    user_query = data.get("query")
    result = generate_answer(user_query, pipeline)
    return jsonify(result)

@app.route("/files/<path:filename>")
def serve_file(filename):
    return send_from_directory("static", filename)

# ---------------------------
# Run Flask App
# ---------------------------
if __name__ == "__main__":
    app.run(debug=True, port=5000)
