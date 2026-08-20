from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import os
from datetime import datetime
from supabase import create_client
import threading

SUPABASE_URL = "https://ckyurlyxqjydhejcbxpo.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNreXVybHl4cWp5ZGhlamNieHBvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzQ0MzEzNywiZXhwIjoyMDk5MDE5MTM3fQ.E5yZ_n0QC6Zsq7vjWRciNPwY2Fc2m80KbIfKN5uGllM"  # store in an environment variable
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# -----------------------------
# Flask Setup
# -----------------------------
app = Flask(__name__)
app.config["SECRET_KEY"] = "chat-secret-key"

socketio = SocketIO(
    app,
    cors_allowed_origins="*"
)

# -----------------------------
# Home Page
# -----------------------------
@app.route("/")
def index():
    return render_template("index.html")

# -----------------------------
# Send Chat History
# -----------------------------
@socketio.on("request_history")
def send_history():

    response = (
        supabase
        .table("messageport5555")
        .select("username, message, timestamp")
        .order("id")
        .limit(500)
        .execute()
    )

    rows = [
        (
            row["username"],
            row["message"],
            row["timestamp"]
        )
        for row in response.data
    ]

    emit("chat_history", rows)

# -----------------------------
# Receive Message
# -----------------------------

@socketio.on("send_message")
def handle_message(data):

    username = data["username"]
    message = data["message"]

    timestamp = datetime.now().strftime("%H:%M:%S")
    supabase.table("messageport5555").insert({
        "username": username,
        "message": message,
        "timestamp": timestamp
    }).execute()

    emit(
        "new_message",
        {
            "username": username,
            "message": message,
            "timestamp": timestamp
        },
        broadcast=True
    )

# -----------------------------
# Clear History
# -----------------------------
@socketio.on("clear_history")
def clear_history():

    supabase.table("messageport5555") \
        .delete() \
        .neq("id", 0) \
        .execute()

    emit("history_cleared", broadcast=True)

# -----------------------------
# Start Server
# -----------------------------




if __name__ == "__main__":

    print("=" * 45)
    print(" Public Chat Server")
    print("=" * 45)
    print("Port: 5555")
    print("Database:", SUPABASE_URL)
    print("=" * 45)

    socketio.run(
        app,
        host="0.0.0.0",
        port=5555
    )