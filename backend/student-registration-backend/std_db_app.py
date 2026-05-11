from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash


# -------------------------------------------
# FLASK + CORS
# -------------------------------------------
app = Flask(__name__)

CORS(
    app,
    origins=["http://localhost:5173"],
    supports_credentials=True,
    allow_headers=["Content-Type"],
    methods=["GET", "POST", "OPTIONS"],
)


# Optional: Ensures preflight OPTIONS requests never fail
@app.after_request
def apply_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:5173"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


# -------------------------------------------
# MONGO CONNECTION
# -------------------------------------------
client = MongoClient("mongodb://localhost:27017")
db = client['studentDB']
users_collection = db['users']


# -------------------------------------------
# REGISTER USER
# -------------------------------------------
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    full_name = data.get('fullName')
    batch = data.get('batch')
    department = data.get('department')
    course = data.get('course')
    semester_year = data.get('semester_year')
    program_type = data.get('program_type')
    hostel = data.get('hostel')
    category = data.get('category')
    email = data.get('email')
    password = data.get('password')

    if users_collection.find_one({'email': email}):
        return jsonify({'message': 'User already exists'}), 400

    hashed_password = generate_password_hash(password)

    users_collection.insert_one({
        "user_id": email,
        "full_name": full_name,
        "batch": batch,
        "department": department,
        "course": course,
        "semester_year": semester_year,
        "program_type": program_type,
        "hostel": hostel,
        "category": category,
        "email": email,
        "password": hashed_password
    })

    return jsonify({'message': 'User registered successfully'}), 201


# -------------------------------------------
# LOGIN USER
# -------------------------------------------
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = users_collection.find_one({'email': email})

    if not user:
        return jsonify({'message': 'User not found'}), 404

    if not check_password_hash(user['password'], password):
        return jsonify({'message': 'Incorrect password'}), 401

    return jsonify({
        'message': f"Welcome {user['full_name']}",
        'user': {
            'user_id': user.get("user_id"),
            'full_name': user.get("full_name"),
            'email': user.get("email"),
            'department': user.get("department"),
            'batch': user.get("batch"),
            'course': user.get("course"),
            'semester_year': user.get("semester_year"),
            'program_type': user.get("program_type"),
            'hostel': user.get("hostel"),
            'category': user.get("category")
        }
    }), 200


# -------------------------------------------
# RUN SERVER (NO RELOADER BUG)
# -------------------------------------------
if __name__ == "__main__":
    app.run(port=5001, debug=True, use_reloader=False)
