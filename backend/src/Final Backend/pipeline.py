import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from llama_index.core import StorageContext, load_index_from_storage
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

from chromadb import PersistentClient
from groq import Groq
import re

# =====================================================
# ENV + FLASK
# =====================================================

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("❌ GROQ_API_KEY missing in .env file!")

app = Flask(__name__)
CORS(app, origins="*", supports_credentials=True)


# =====================================================
# HELPERS
# =====================================================

def init_llm() -> Groq:
    return Groq(api_key=GROQ_API_KEY)


def groq_generate(llm_client: Groq, prompt: str) -> str:
    resp = llm_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.05,
    )
    return resp.choices[0].message.content.strip()


def init_embed_model():
    return HuggingFaceEmbedding(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        cache_folder="./model_cache",
        embed_batch_size=8,
    )


def init_vector_store(path="./chroma_db", name="rag-collection"):
    client = PersistentClient(path=path)
    collection = client.get_or_create_collection(name)
    return ChromaVectorStore(chroma_collection=collection, persist_path=path)


def load_index(embed_model=None, vector_store=None):
    storage = StorageContext.from_defaults(
        persist_dir="./index",
        vector_store=vector_store,
    )
    return load_index_from_storage(storage, embed_model=embed_model)


# =====================================================
# LINK EXTRACTOR
# =====================================================

def extract_markdown_links(text: str):
    pattern = r"\[([^\]]+)\]\((https?://[^\)]+)\)"
    matches = re.findall(pattern, text)
    return [{"label": m[0], "url": m[1]} for m in matches]


# =====================================================
# PROFILE BUILDER
# =====================================================

def build_user_profile_text(profile: dict) -> str:
    if not profile:
        return "User Profile: (Guest)\n"

    labels = {
        "full_name": "Name",
        "department": "Department",
        "course": "Course",
        "batch": "Batch",
        "program_type": "Program Type",
        "semester_year": "Semester/Year",
        "hostel": "Hostel",
        "category": "Category",
        "email": "Email",
    }

    parts = [
        f"- {label}: {profile[key]}"
        for key, label in labels.items()
        if profile.get(key)
    ]

    return "User Profile:\n" + "\n".join(parts) + "\n"


# =====================================================
# INITIALIZE RAG PIPELINE
# =====================================================

llm_client = init_llm()
embed_model = init_embed_model()
vector_store = init_vector_store()
index = load_index(embed_model, vector_store)

print("✅ PU Chatbot Pipeline Ready!")


# =====================================================
# SESSION STATE
# =====================================================

session = {"original_query": None, "expecting": False}


# =====================================================
# CORE ANSWER ENGINE
# =====================================================

def generate_answer(query: str, profile: dict):
    global session
    q = query.lower().strip()

    # ==========================================
    # DIRECT SMART ANSWERS (NO CLARIFICATION)
    # ==========================================

    # --- PYQ ---
    if any(x in q for x in ["pyq", "previous year", "question paper", "old paper"]):
        return {
            "reply": "Here is the previous year paper link for UIET:",
            "follow_ups": ["Admission process", "Hostel information", "Placements in UIET"],
            "pdf": None,
            "links": [
                {
                    "label": "📚 Previous Year Papers (UIET / PU)",
                    "url": "https://uiet.puchd.ac.in/?page_id=4119"
                }
            ]
        }

    # --- SIMPLE SYLLABUS ---
    if "syllabus" in q and "cse" in q:
        return {
            "reply": "Here is the CSE B.Tech syllabus:",
            "follow_ups": ["CSE course structure", "UIET academic calendar", "Exam schedule"],
            "pdf": None,
            "links": [
                {
                    "label": "📘 CSE B.Tech Syllabus",
                    "url": "https://puchd.ac.in/syllabus.php"
                }
            ]
        }

    # ==================================================
    # VAGUE QUERIES → ASK CLARIFICATION
    # ==================================================

    VAGUE = ["fee", "hostel", "scholarship", "form", "apply"]

    if session["expecting"] and session["original_query"]:
        query = f"{session['original_query']} for {query}"
        session["expecting"] = False
        session["original_query"] = None

    else:
        if any(v in q for v in VAGUE):
            if profile.get("department"):
                query = f"{query} for {profile['department']}"
            else:
                session["original_query"] = query
                session["expecting"] = True
                return {
                    "reply": (
                        "Could you please clarify which program you're referring to?\n"
                        "- UG (B.Tech)\n"
                        "- PG (M.Tech)\n"
                        "- Other UIET programmes"
                    ),
                    "follow_ups": [],
                    "pdf": None,
                    "links": []
                }

    # ==================================================
    # RAG RETRIEVAL
    # ==================================================

    retriever = index.as_retriever(similarity_top_k=8)
    nodes = retriever.retrieve(query)
    context = "\n---\n".join([n.get_content() for n in nodes])
    profile_text = build_user_profile_text(profile)

    # ==================================================
    # BUILD LLM PROMPT
    # ==================================================

    prompt = f"""
You are PU-Assistant, the official AI helpdesk chatbot of Panjab University, Chandigarh.

You must answer the student’s query strictly using the verified information provided below in the context.
Never use your own knowledge, never guess, and never add anything that is not explicitly present in the context.

---------------------------------------------
STUDENT PROFILE (use only for personalization):
---------------------------------------------
The following information is about the logged-in student. Use it only to:
- Prefer the information relevant to their department, course, level (UG/PG), year/semester, and hostel.
- If multiple programmes exist in the context, choose the one that matches this profile.
- Never contradict the profile.
- If any profile field is missing, answer normally without guessing.

{profile_text}

---------------------------------------------
ANSWERING RULES (apply exactly as written):
---------------------------------------------
1. If the question is about eligibility, admission steps, rules, process, fees, or forms:
   → Answer clearly using neat bullet points (maximum 4–6 points).

2. For simple factual or definition-style questions:
   → Reply in one direct, precise sentence.

3. If any web page, downloadable form, or PDF is mentioned in the context:
   → Include it as a clickable markdown link.
   → BUT always use the exact link caption found in the context 
     (e.g., “📄 Download official fee PDF here”).
   → Never create your own link labels.
   → Only include links that are explicitly present in the context.
   → All links must open in a new tab.

4. Never guess, assume, or generate a URL that is not found in the context.

5. If both ₹ (INR) and $ (USD) appear in the context:
   → Mention only the ₹ (INR) amount.

6. If the required information is not found in the context:
   → Respond politely with exactly one of these:
     - "Sorry, I couldn't find that information. Please contact the university administration."
     - "Sorry, I couldn't help you with that. Please check the official website."

7. Never say “context not available”, “data not found”, or anything similar.

8. Maintain a formal, professional, and polite tone throughout.

9. Avoid repetition and unnecessary introductions.

10. You must always use the same bullet structure, titles, and formatting every time the same question is asked.

11. Strictly answer only from the “Verified Information” context.

12. If required details like eligibility, exam name, or process are present in the context, you must include them.

13. Do NOT add any details not present in the context.

14. If the question is specifically about admission, then answer strictly about the admission process only — 
    ignore hostel, fees, scholarships, or anything else unless asked.

15. If the user writes an unclear, unknown, or misspelled word (e.g., “stuce”) and its meaning is not guaranteed:
    → Do NOT guess.
    → Politely ask:
      "Sorry, could you please clarify what you meant by \"stuce\"?"

16.  STATIC OFFICIAL LINKS LIBRARY  
   Use these ONLY IF:
   - The user directly asks for them, AND
   - The RAG context does NOT contain a more specific link.


   Rules:
   - Do NOT rewrite captions.
   - NEVER create new URLs.

---------------------------------------------
SMART CLARIFICATION LOGIC (very important):
---------------------------------------------
If the student’s question is vague, broad, or incomplete (e.g., “fee structure”, “course”, “apply”, “form”, “hostel”, “scholarship”, etc.):
   → DO NOT answer immediately.
   → Ask for clarification using exactly this format:

   > Could you please clarify which of the following you're referring to?  
   > - Option 1  
   > - Option 2  
   > - Option 3

Examples:
- For “fee structure”:
  > Could you please clarify which of the following departments you're referring to regarding the fee structure?  
  > - University Institute of Engineering & Technology (UIET)  
  > - Department of Law  
  > - Department of Computer Science & Applications  

- For “hostel”:
  > Are you referring to:  
  > - Boys’ hostels  
  > - Girls’ hostels  
  > - International student hostels

- For “scholarship”:
  > Are you asking about:  
  > - Need-based scholarships  
  > - Merit scholarships  
  > - Reserved category benefits

Never explain why you are asking. Just ask and wait.

---------------------------------------------
FOLLOW-UP QUESTIONS (MANDATORY):
---------------------------------------------
After your main answer, you MUST ALWAYS add:

Know more about:
- Topic 1
- Topic 2
- Topic 3

Rules:
- ALWAYS generate exactly three follow-up topics.
- They must be short (max 5–6 words).
- They must be helpful and related to admissions, fees, hostels, scholarships, placements, campus life.
- Do NOT repeat user’s original question.
- Do NOT copy lines from the context.
- MUST ALWAYS follow EXACT format:

Know more about:
- _______
- _______
- _______


USE ONLY THIS VERIFIED INFORMATION TO ANSWER:
{context}
STUDENT’S QUESTION:
{query}
YOUR ANSWER:
""".strip()

    # LLM CALL
    try:
        answer = groq_generate(llm_client, prompt)
    except:
        return {
            "reply": "⚠️ Server error. Please try again.",
            "follow_ups": [],
            "pdf": None,
            "links": []
        }

    # ==================================================
    # PROCESS LLM OUTPUT
    # ==================================================

    llm_links = extract_markdown_links(answer)

    # Extract follow-ups
    followups = []
    block = re.search(r"Know more about:\s*((?:- .*\n?)+)", answer)
    if block:
        followups = [
            ln.replace("-", "").strip()
            for ln in block.group(1).strip().split("\n")
        ]
    followups = followups[:3]

    # Clean text
    cleaned = re.sub(r"https?://\S+", "", answer)
    cleaned = re.sub(r"\[[^\]]+\]\([^\)]+\)", "", cleaned)
    cleaned = re.sub(r"Know more about:.*", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.strip()

    # ==================================================
    # STATIC LINKS BASED ON QUERY
    # ==================================================

    extra_links = []
    Q = q

    # --- PYQ ---
    if any(w in Q for w in ["pyq", "question paper", "previous year", "old paper"]):
        extra_links.append({
            "label": "📚 Previous Year Papers (UIET / PU)",
            "url": "https://uiet.puchd.ac.in/?page_id=4119"
        })

    # --- ADMISSION ---
    elif "admission" in Q:
        extra_links.append({
            "label": "🌐 PU Admission Portal",
            "url": "https://admissions.puchd.ac.in/"
        })
        extra_links.append({
            "label": "🏛️ Official UIET Website",
            "url": "https://uiet.puchd.ac.in/"
        })

    # --- FEE ---
    elif "fee" in Q:
        extra_links.append({
            "label": "📄 Official PU Fee Structure",
            "url": "https://puchd.ac.in/important-docs/fee-structure.pdf"
        })
        extra_links.append({
            "label": "💳 PU Fee Payment Portal",
            "url": "https://payonline.puchd.ac.in/"
        })

    # --- SYLLABUS ---
    elif any(w in Q for w in ["syllabus", "course", "subjects"]):
        extra_links.append({
            "label": "📘 Syllabus (All Departments)",
            "url": "https://puchd.ac.in/syllabus.php"
        })

    # --- HOSTEL ---
    elif "hostel" in Q:
        extra_links.append({
            "label": "🏠 PU Hostel Information",
            "url": "https://puchd.ac.in/hostel.php"
        })

    final_links = llm_links + extra_links

    return {
        "reply": cleaned,
        "follow_ups": followups,
        "pdf": None,
        "links": final_links
    }


# =====================================================
# API ROUTES
# =====================================================

@app.route("/api/chat", methods=["POST"])
def chat_api():
    data = request.get_json() or {}
    query = data.get("message", "").strip()
    profile = data.get("student_profile") or {}

    if not query:
        return jsonify({"reply": "Please type something."})

    return jsonify(generate_answer(query, profile))


@app.route("/files/<path:filename>")
def download_file(filename):
    return send_from_directory("static", filename, as_attachment=True)


@app.route("/healthz")
def health():
    return "OK", 200


if __name__ == "__main__":
    app.run(port=5000, host="0.0.0.0", debug=True, use_reloader=False)
