
import React, { useEffect, useState } from "react";
import { AssignTag, GetTagDetails } from "../../services/TagApi";
import "../../styles/TagAssign.css";

const TagAssign = ({ selectedItems, fileId, setTagAssign,setContextMenu }) => {
  const [availableTags, setAvailableTags] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchTags = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await GetTagDetails();
      if (response.status === 200) {
        setAvailableTags(response.data);
      } else {
        throw new Error("Failed to fetch tags");
      }
    } catch (err) {
      setError("Unable to load tags. Please try again.");
      console.error("Error fetching tags:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isModalOpen) {
      fetchTags();

    }
  }, [isModalOpen]);

  const handleAssignTag = async (tagId) => {
    try {
      const uniqueIds = selectedItems
        .filter((item) => item.data?.uniqueId)
        .map((item) => item.data.uniqueId);

      if (uniqueIds.length === 0) {
        alert("No valid items selected.");
        return;
      }

      const response = await AssignTag(tagId, uniqueIds, fileId);
      if (response.status === 200) {
        alert("Tag assigned successfully");
        setTagAssign(response);
        setIsModalOpen(false);
        setContextMenu({ visible: false, x: 0, y: 0 });

      } else {
        throw new Error("Failed to assign tag");
      }
    } catch (err) {
      console.error("Error assigning tag:", err);
      alert("Failed to assign tag. Please try again.");
    }
  };

  return (
    <div className="tag-assign-container">
      <button
        className="assign-tag-button"
        onClick={() => setIsModalOpen(true)}
        disabled={isLoading || selectedItems.length === 0}
        aria-label="Assign a tag to selected items"
      >
        Assign Tag
      </button>

      {isModalOpen && (
        <div
          className="tag-modal-overlay"
          onClick={() => setIsModalOpen(false)}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="tag-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tag-modal-header">
              <h3 className="tag-modal-title">Assign Tag</h3>
              <button
                className="close-button"
                onClick={() => {setIsModalOpen(false);
                        setContextMenu({ visible: false, x: 0, y: 0 });} 

                }
                aria-label="Close tag assignment modal"
              >
                &times;
              </button>
            </div>

            <div className="tag-modal-body">
              {isLoading ? (
                <div className="loading-state">Loading tags...</div>
              ) : error ? (
                <div className="error-state">
                  <p>{error}</p>
                  <button
                    onClick={fetchTags}
                    className="retry-button"
                    aria-label="Retry loading tags"
                  >
                    Retry
                  </button>
                </div>
              ) : availableTags.length > 0 ? (
                <ul className="tag-list"
                    role="listbox"
                    aria-label="Available tags">
                  {availableTags.map((tag) => (
                    <li
                      key={tag.tagId}
                      className="tag-item"
                      onClick={() => handleAssignTag(tag.tagId)}
                      role="option"
                      aria-selected={selectedItems.some(
                        (item) => item.data?.tagId === tag.tagId
                      )}
                    >
                      {tag.name}
                      {selectedItems.some(
                        (item) => item.data?.tagId === tag.tagId
                      ) && <span className="selected-indicator">✓</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state">No tags available.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagAssign;
