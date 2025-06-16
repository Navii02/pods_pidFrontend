import React, { useState } from "react";
import CommentModal from "../components/CommentModal";

function Iroamer() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const mockContent = {
    intersectionPointX: 100,
    intersectionPointY: 200,
    intersectionPointZ: 300,
  };

  const mockStatusList = [
    { statusname: "Open" },
    { statusname: "Resolved" },
    { statusname: "Pending" },
  ];

  return (
    <div>
      <button onClick={() => setIsModalOpen(true)}>Open Comment Modal</button>

      <CommentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        content={mockContent}
        allCommentStatus={mockStatusList}
        docdetnum="DOC123"
      />
    </div>
  );
}

export default Iroamer;
