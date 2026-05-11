
import Chatbot from "../Chatbot";  // <-- yaha dhyaan do (agar ChatPage "pages" folder me hai)

function ChatPage() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Chatbot />
    </div>
  );
}

export default ChatPage;
