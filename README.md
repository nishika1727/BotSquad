# AISOC Summer Internship – Team BotSquad

## 👥 Team Members

- **Nishika Rawat** – [nishikapnp2004@gmail.com]  
- **Nikhil Kaundal** – [nikhilkaundal1257@gmail.com]  
- **Rhythm Pandey** – [rhythmjk30@gmail.com]  
- **Manthan Dhiman** – [dhimaan0011@gmail.com]

## 📌 Assigned Problem Statement

**Title:** RAG-Based Chatbot for Panjab University  
**Description:**  
Develop a chatbot system using Retrieval-Augmented Generation (RAG) that leverages official Panjab University web content to provide instant, accurate answers to student queries. The chatbot should integrate advanced AI techniques and frameworks like LangChain or LlamaIndex for context-aware responses.

## 🚀 Quick Start Guide

### Prerequisites

- Python 3.8 or higher
- `pip` or `conda`
- Git
- Virtual environment (recommended)

### Setup Instructions

```bash
# Step 1: Clone the repository
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name

# Step 2: Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Step 3: Install dependencies
pip install -r requirements.txt

# Step 4: Run the chatbot (example using Streamlit)
streamlit run app.py
```

## 📅 Timeline and Milestones  
| Week | Milestone                                                   |
|------|--------------------------------------------------------------|
| 1    | Project setup, repository structuring, scraping strategy planned |
| 2    | Website and PDF scraping completed, raw data stored         |
| 3    | Data cleaning, preprocessing, and chunking finalized        |
| 4    | Embedding with HuggingFace, indexing via LlamaIndex         |
| 5    | Chatbot development and Streamlit interface integration     |
| 6    | Final testing, documentation, demo upload, and presentation prep |


## 💡 Project File Structure & Key Components

### 📁 Frontend Main Component

> 📄 **Location:** `frontend/src/App.tsx`

This file contains the **main React component** that renders the chatbot UI.  
It includes:
- User and assistant chat bubbles
- Quick reply buttons
- Markdown support with clickable links
- Responsive design for mobile
  
This is where the chatbot messages are displayed and sent to the backend via API.

### 🎨 Frontend Global Styling

> 📄 **Location:** `frontend/src/index.css`

This file defines the **global styling** for the chatbot UI.  
It includes:
- Chat layout and message alignment (user/assistant)
- Chat bubble design and colors
- Button styling (feedback, quick replies)
- Scrollbar and mobile responsiveness
- Font, spacing, and hover effects

This CSS ensures a clean and user-friendly appearance of the chatbot interface.

##  Backend Directory Structure

📁 **Path:** `backend/src/Final Backend/`

This folder contains the complete Flask-based RAG chatbot backend for Panjab University. Below is the breakdown of important files and folders:

---

### 📄 Python Files

| File Name             | Description                                                 |
|-----------------------|-------------------------------------------------------------|
| `app.py`              | Flask server entry point.                                   |
| `rag_pipeline.py`     | Main RAG pipeline logic with retrieval + generation.        |
| `indexing.py`         | Handles indexing of data into vector store.                 |
| `intent_links.py`     | Keyword-to-URL intent mapping logic.                        |
| `db_creation.py`      | CSV/JSON creation script from raw scraped data.             |

---

### 📊 Data & Notebooks

| File Name                            | Description                                                |
|--------------------------------------|------------------------------------------------------------|
| `data.jsonl`                         | JSON version of above data for easy parsing.                  |
| `Collecting and cleaning data.ipynb` | Notebook for scraping and cleaning raw admission data.     |
| `Data collection.ipynb`              | Notebook to collect data from PU website.                  |

---

### 📁 Folders

| Folder Name      | Description                                                    |
|------------------|----------------------------------------------------------------|
| `chroma_db/`     | Stores Chroma vector DB files.                                 |
| `index/`         | LlamaIndex-generated index folder.                             |
| `static/`        | Flask static file folder (if needed).                          |
| `venv/`          | Python virtual environment (not pushed to GitHub).             |

---

### ⚙️ Config & Dependencies

| File Name         | Description                                        |
|-------------------|----------------------------------------------------|
| `.env`            | Environment variables (API keys, etc.).            |
| `requirements.txt`| Python dependencies required for backend.          |

## 🖥️ Chatbot User Interface

<p align="center">
  <img src="https://raw.githubusercontent.com/nikhil1234567890123/RAG-Based-Chatbot-for-PU-Campus/main/Working%20Demo/Screenshot%202025-11-29%20201620.png" width="750"/>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/nikhil1234567890123/RAG-Based-Chatbot-for-PU-Campus/main/Working%20Demo/Screenshot%202025-11-29%20201637.png" width="750"/>
</p>




Google Drive Link - [https://drive.google.com/drive/folders/1sHEoTyRxrI7slUVEAfngH8v_WSv5__8J?usp=sharing ]

---
