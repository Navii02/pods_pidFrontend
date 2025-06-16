import React, { useState, useEffect } from "react";
import Alert from "../components/AlertModal";

function CommentModal({
  isOpen,
  onClose,
  content,
  allCommentStatus,
  docdetnum,
}) {
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
   const [customAlert, setCustomAlert] = useState(false);
    const [modalMessage, setModalMessage] = useState("");

   // --------------------------------------------------------------------//
    const [floatingPosition, setFloatingPosition] = useState({ x: 100, y: 100 });
    const [size, setSize] = useState({ width: 380, height: 290 });
    const [dragging, setDragging] = useState(false);
    const [resizing, setResizing] = useState(false);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isMaximized, setIsMaximized] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [startSize, setStartSize] = useState({ width: 0, height: 0 });
    const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  
    // Start dragging
    const startDrag = (e) => {
      if (!isMaximized) {
        e.preventDefault();
        setDragging(true);
        setOffset({
          x: e.clientX - floatingPosition.x,
          y: e.clientY - floatingPosition.y,
        });
      }
    };
  
    // Start Resizing
    const startResize = (e) => {
      e.preventDefault();
      setResizing(true);
      setStartPosition({ x: e.clientX, y: e.clientY });
      setStartSize({ width: size.width, height: size.height });
    };
  
    // Stop dragging and resizing
    const stopActions = () => {
      setDragging(false);
      setResizing(false);
    };
  
    // Handle Resizing & Dragging
    useEffect(() => {
      const onMouseMove = (e) => {
        if (resizing && !isMaximized) {
          const deltaWidth = e.clientX - startPosition.x;
          const deltaHeight = e.clientY - startPosition.y;
  
          setSize({
            width: Math.max(200, startSize.width + deltaWidth),
            height: Math.max(100, startSize.height + deltaHeight),
          });
        } else if (dragging && !isMaximized) {
          setFloatingPosition({
            x: e.clientX - offset.x,
            y: e.clientY - offset.y,
          });
        }
      };
  
      const onMouseUp = () => {
        stopActions();
      };
  
      if (resizing || dragging) {
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      }
  
      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
    }, [resizing, dragging, offset, startPosition, startSize, isMaximized]);
  
    // Toggle Maximize
    const toggleMaximize = () => {
      if (isMaximized) {
        setSize({ width: 380, height: 290 });
        setFloatingPosition({ x: 100, y: 100 });
      } else {
        setSize({
          width: window.innerWidth - 60,
          height: window.innerHeight - 20,
        });
        setFloatingPosition({ x: 10, y: 10 });
      }
      setIsMaximized(!isMaximized);
    };
  
    // Toggle Minimize
    const toggleMinimize = () => {
      setIsMinimized(!isMinimized);
    };
  
    // Close Window
    const onCloseFW = () => {     
      // Reset floating window position and size
    setFloatingPosition({ x: 100, y: 100 });
    setSize({ width: 380, height: 290 });
    setIsMaximized(false);
    setIsMinimized(false); 
    onClose();

    
    };
    // --------------------------------------------------------//

  const handleCommentClick = () => {
    if (!comment) {
      setCustomAlert(true);
      setModalMessage("Please enter a comment.");
      return;
    }
    if(!content){
      setCustomAlert(true);
      setModalMessage("Please choose proper point")
    }

    const data = {
      docnumber: docdetnum || "",
      comment,
      status,
      priority,
      coordinateX: content.intersectionPointX,
      coordinateY: content.intersectionPointY,
      coordinateZ: content.intersectionPointZ,
    };

    console.log("Saving Comment:", data);
    window.api.send("add-comment", data);

    setComment("");
    setStatus("");
    setPriority("");
       // Reset floating window position and size
       setFloatingPosition({ x: 100, y: 100 });
       setSize({ width: 380, height: 290 });
       setIsMaximized(false);
       setIsMinimized(false);  
       onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      setComment("");
      setStatus("");
      setPriority("");
    }
  }, [isOpen]);

    const handleCancel = () => {
     
       // Reset floating window position and size
    setFloatingPosition({ x: 100, y: 100 });
    setSize({ width: 380, height: 290 });
    setIsMaximized(false);
    setIsMinimized(false);  
    onClose();
    };
  return (
    <>
      {isOpen && (
      
        <div
          className="floating-window"
          style={{
            position: "fixed",
            zIndex: 2,
            transform: "translateZ(0)",
            willChange: "transform",
            top: floatingPosition.y,
            left: floatingPosition.x,
            width: size.width,
            height: isMinimized ? "40px" : size.height,
            background: "white",
            border: "1px solid #ccc",
            boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
            borderRadius: "8px",
            overflow: "hidden",
            userSelect: "none",
          }}
        >
          {/* Header */}
          <div
            className="floating-header"
            style={{
              background: "#090909",
              color: "white",
              padding: "8px",
              cursor: isMaximized ? "default" : "grab",
              borderTopLeftRadius: "8px",
              borderTopRightRadius: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              userSelect: "none",
            }}
            onMouseDown={startDrag}
          >
            <span>Set Comment</span>
            <div>
              <button onClick={toggleMinimize} style={buttonStyle}>
                -
              </button>
              <button onClick={toggleMaximize} style={buttonStyle}>
                {isMaximized ? "🗗" : "⬜"}
              </button>
              <button onClick={onCloseFW} style={buttonStyle}>
                ✖
              </button>
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <div
              className="floating-content"
              style={{
                height: "calc(100% - 40px)",
                overflowY: "auto",
                userSelect: "none",
                paddingLeft: "10px",
                paddingRight: "10px",
                paddingTop: "10px",
              }}
            >

              <div className="input-group">
                  <label className="text-dark">Comment</label>
            <textarea
              id="commentInput"
              placeholder="Enter your comment here..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            ></textarea>
                <label className="text-dark">Status:</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="" disabled>
                Choose status
              </option>
              {allCommentStatus.map((statusOption) => (
                <option
                  key={statusOption.statusname}
                  value={statusOption.statusname}
                >
                  {statusOption.statusname}
                </option>
              ))}
            </select>
                <label className="text-dark">Priority:</label>
              <div style={{ display: "flex", flexDirection: "row" }}>
                {[1, 2, 3].map((num) => (
                  <label className="text-dark"  key={num} style={{ margin: "0 5px" }}>
                    <input
                      type="radio"
                      name="priority"
                      value={num}
                      checked={priority === String(num)}
                      onChange={(e) => setPriority(e.target.value)}
                    />
                    {num}
                  </label>
                ))}
                  </div>
              </div>
              <div className="popup-buttons">
                <button onClick={handleCommentClick} className="btn btn-dark">
                  Save
                </button>
                <button onClick={handleCancel} className="btn btn-danger">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Resize Handle */}
          {!isMinimized && !isMaximized && (
            <div
              className="resize-handle"
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: "20px",
                height: "20px",
                cursor: "se-resize",
                zIndex: 2147483647,
                background: `
                 linear-gradient(135deg, transparent 0%, transparent 50%, 
                 gray 50%, gray 100%)
               `,
              }}
              onMouseDown={startResize}
            />
          )}
        </div>
      )}
 {customAlert && (
        <Alert
          message={modalMessage}
          onAlertClose={() => setCustomAlert(false)}
        />
      )}

    </>
  );
}
// Styles remain the same
const buttonStyle = {
  background: "transparent",
  color: "white",
  border: "none",
  cursor: "pointer",
  fontSize: "16px",
  marginRight: "8px",
};

export default CommentModal;
