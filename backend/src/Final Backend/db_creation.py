# pdf_to_index_jsonl.py

import os
import json
import pandas as pd
import re
import neattext.functions as nfx
from tqdm import tqdm
from llama_index.core import Document, VectorStoreIndex, StorageContext
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.core.node_parser import SimpleNodeParser
from chromadb import PersistentClient

# 1. Load line-by-line JSONL into DataFrame
def load_jsonl_to_dataframe(filepath: str) -> pd.DataFrame:
    records = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            record = json.loads(line)
            records.append(record)
    return pd.DataFrame(records)

# 2. Clean text content
def clean_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = nfx.remove_multiple_spaces(text)
    text = re.sub(r'\s+', ' ', re.sub(r'[^A-Za-z0-9\-\(\)\s]', ' ', text))
    return text.strip()

# 3. Token-based chunking
def chunk_text_token_based(text, tokenizer, max_tokens=512, stride=50):
    tokens = tokenizer.encode(text, add_special_tokens=False, truncation=False)
    chunks = []
    start = 0
    while start < len(tokens):
        end = start + max_tokens
        chunk_tokens = tokens[start:end]
        chunk = tokenizer.decode(chunk_tokens, skip_special_tokens=True)
        chunks.append(chunk)
        start += max_tokens - stride
    return chunks

# 4. Main processing and indexing function
def process_and_index(filepath: str, tokenizer):
    # Load and clean data
    df = load_jsonl_to_dataframe(filepath)
    df['cleaned_text'] = df['content'].apply(clean_text)

    # Chunk the text
    df['chunks'] = df['cleaned_text'].apply(lambda x: chunk_text_token_based(x, tokenizer))

    # Embedding model
    embed_model = HuggingFaceEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")

    # Setup Chroma vector store
    persist_dir = "./chroma_db2"
    client = PersistentClient(path=persist_dir)
    collection = client.get_or_create_collection("rag-collection")
    vector_store = ChromaVectorStore(chroma_collection=collection, persist_dir=persist_dir)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    # Create documents with metadata
    documents = []
    for idx, row in tqdm(df.iterrows(), total=len(df), desc="📄 Creating documents"):
        for i, chunk in enumerate(row['chunks']):
            documents.append(Document(
                text=chunk,
                metadata={
                    "source": row.get("source_pdf", ""),
                    "department": row.get("department", ""),
                    "section": row.get("section", ""),
                    "page_number": row.get("page_number", -1),
                    "chunk_id": f"chunk_{idx}_{i}"
                }
            ))

    # Parse to nodes
    parser = SimpleNodeParser()
    nodes = []
    for doc in tqdm(documents, desc="📄 Parsing documents"):
        nodes.extend(parser.get_nodes_from_documents([doc]))

    # Add embeddings
    for node in tqdm(nodes, desc="🔍 Embedding nodes"):
        node.embedding = embed_model.get_text_embedding(node.text)

    # Build index
    index = VectorStoreIndex(
        nodes,
        storage_context=storage_context,
        embed_model=embed_model
    )

    # Save
    index.storage_context.persist(persist_dir="./index2")
    print(f"\n✅ Index created and persisted with {len(nodes)} nodes.")

# Example usage
if __name__ == "__main__":
    from transformers import AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
    process_and_index("data.jsonl", tokenizer)
