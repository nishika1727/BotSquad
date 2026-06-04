from flask import Flask, request, jsonify
from flask_cors import CORS
from rag_pipeline import generate_answer   # import from step 1

app = Flask(__name__)
CORS(app)  # allow frontend to call backend

@app.route("/", methods=["GET"])
def home():
    return "✅ PU Assistant backend is running!"

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    query = data.get('message')
    student_profile = data.get('student_profile', None)
    print(f"Received query: {query}")

    try:
        result = generate_answer(query, student_profile=student_profile)
        if isinstance(result, dict):
            return jsonify(result)
        else:
            return jsonify({
                "reply": result,
                "follow_ups": ["Scholarships", "Hostels", "Campus Life"]
            })
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({
            "reply": "Sorry, something went wrong. Please visit the admin office.",
            "follow_ups": []
        })

if __name__ == '__main__':
    app.run(port=5000)
