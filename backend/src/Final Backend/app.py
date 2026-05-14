import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from rag_pipeline import generate_answer, pipeline

# --- Logging Configuration ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# Allow frontend to call backend (Vite default is 5173)
CORS(app, resources={r"/api/*": {"origins": "*"}}) 

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "online",
        "message": "✅ PU Assistant backend is running!",
        "version": "1.0.0"
    }), 200

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    if not data or 'message' not in data:
        return jsonify({"error": "Missing 'message' in request body"}), 400

    query = data.get('message')
    logger.info(f"Received query: {query}")

    try:
        # Pass the global pipeline object to the generator
        result = generate_answer(query, pipeline)
        logger.info(f"Generated answer successfully for query: {query[:50]}...")
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"❌ Error during generation: {e}", exc_info=True)
        return jsonify({
            "reply": "Sorry, I encountered an internal error. Please try again later or contact support.",
            "follow_ups": []
        }), 500

if __name__ == '__main__':
    logger.info("Starting PU Assistant Backend on port 5000...")
    app.run(port=5000, host="0.0.0.0", debug=False)
