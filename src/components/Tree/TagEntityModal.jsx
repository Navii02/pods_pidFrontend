import React, { useEffect, useState, useMemo } from "react";
import { Modal, Button, Form, InputGroup, FormControl, Spinner } from "react-bootstrap";
import { GetEntities, RegisterTagsforsystem } from "../../services/TreeManagementApi";
import { RegisterTag } from "../../services/TagApi";

const TagEntityModal = ({ showTagModalFor, setShowTagModalFor, selectedProject, tagsMap, onSuccess }) => {
  const [showRegisterTagModal, setShowRegisterTagModal] = useState(false);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [parentTagOptions, setParentTagOptions] = useState([]);
  const [isLoadingParentTags, setIsLoadingParentTags] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    tagNumber: "",
    parentTag: "",
    name: "",
    type: "",
    model: null,
    project_id: selectedProject?.projectId || "",
  });

  // Memoize tagsMapArray to avoid repeated computation
  const tagsMapArray = useMemo(() => {
    return Array.isArray(tagsMap) ? tagsMap : Object.values(tagsMap || {}).flat();
  }, [tagsMap]);

  // Fetch project tags and parent tags
  useEffect(() => {
    if (selectedProject?.projectId) {
      fetchProjectTags();
      fetchParentTags();
    }
  }, [selectedProject]);

  const fetchProjectTags = async () => {
    try {
      setIsLoadingTags(true);
      const response = await GetEntities("tag", selectedProject.projectId);
      if (response.status === 200) {
        setTags(response.data.tags || []);
      }
    } catch (error) {
      console.error("Failed to fetch tags:", error);
      alert("Failed to fetch tags. Please try again.");
    } finally {
      setIsLoadingTags(false);
    }
  };

  const fetchParentTags = async () => {
    try {
      setIsLoadingParentTags(true);
      const response = await GetEntities("tag", selectedProject.projectId);
      if (response.status === 200) {
        setParentTagOptions(response.data.tags || []);
      }
    } catch (error) {
      console.error("Error fetching parent tags:", error);
      alert("Failed to fetch parent tags. Please try again.");
    } finally {
      setIsLoadingParentTags(false);
    }
  };

  // Handle tag selection (using tag.number for consistency)
  const handleTagSelection = (tagNumber, isChecked) => {
    setSelectedTags((prev) =>
      isChecked ? [...prev, tagNumber] : prev.filter((num) => num !== tagNumber)
    );
  };

  // Select all filtered tags
  const handleSelectAll = () => {
    const filteredTagNumbers = filteredTags.map((tag) => tag.number);
    setSelectedTags((prev) => [...new Set([...prev, ...filteredTagNumbers])]);
  };

  // Clear all selected tags
  const handleClearAll = () => {
    setSelectedTags([]);
  };

  // Assign selected tags to the system
  const handleAssignTags = async () => {
    if (!showTagModalFor || selectedTags.length === 0) {
      alert("No tags selected or invalid context.");
      return;
    }

    try {
      setIsLoading(true);
      for (const tagNumber of selectedTags) {
        const tag = tags.find((t) => t.number === tagNumber);
        if (!tag) continue;

        const payload = {
          project_id: selectedProject.projectId,
          area: showTagModalFor.area,
          disc: showTagModalFor.disc,
          sys: showTagModalFor.sys,
          code: tag.number,
          name: tag.name,
        };

        const response = await RegisterTagsforsystem(payload);
        if (response.status !== 200) {
          throw new Error(`Failed to assign tag: ${tag.name}`);
        }
      }

      await onSuccess({
        refetch: true,
        entityType: "Tag",
        parentInfo: {
          area: showTagModalFor.area,
          disc: showTagModalFor.disc,
          sys: showTagModalFor.sys,
        },
      });

      alert("Tags assigned successfully!");
      setSelectedTags([]);
      setShowTagModalFor(null);
    } catch (error) {
      console.error("Failed to assign tags:", error);
      alert(`Failed to assign tags: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value, project_id: selectedProject?.projectId || "" }));
  };

  // Handle file input for model
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size > 10 * 1024 * 1024) {
      alert("Please select a file smaller than 10MB");
      return;
    }
    setFormData((prev) => ({ ...prev, model: file }));
  };

  // Validate form for registering a new tag
  const validateForm = () => {
    if (!selectedProject?.projectId) {
      alert("No project selected. Please select a project first.");
      return false;
    }
    if (!formData.tagNumber.trim()) {
      alert("Tag number is required");
      return false;
    }
    if (!formData.type) {
      alert("Tag type is required");
      return false;
    }
    return true;
  };

  // Register a new tag
  const handleRegisterTag = async () => {
    if (!validateForm()) return;

    try {
      setIsLoading(true);
      const response = await RegisterTag(formData);
      if (response.status === 201) {
        alert("Tag registered successfully!");
        setFormData({
          tagNumber: "",
          parentTag: "",
          name: "",
          type: "",
          model: null,
          project_id: selectedProject?.projectId || "",
        });
        setShowRegisterTagModal(false);
        await fetchProjectTags();
      }
    } catch (error) {
      console.error("Error during tag registration:", error);
      const errorMessage =
        error.response?.data?.message || error.response?.data?.error || "An error occurred while registering the tag.";
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Memoized filtered tags
  const filteredTags = useMemo(() => {
    return tags
      .filter((tag) => tag.number.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((tag) => (typeFilter === "all" ? true : tag.type === typeFilter))
      .filter((tag) => {
        const isAssigned = tagsMapArray.some(
          (t) =>
            t.area === showTagModalFor?.area &&
            t.disc === showTagModalFor?.disc &&
            t.sys === showTagModalFor?.sys &&
            t.tag === tag.number
        );
        if (assignmentFilter === "assigned") return isAssigned;
        if (assignmentFilter === "unassigned") return !isAssigned;
        return true;
      })
      .sort((a, b) => {
        const aAssigned = tagsMapArray.some(
          (t) =>
            t.area === showTagModalFor?.area &&
            t.disc === showTagModalFor?.disc &&
            t.sys === showTagModalFor?.sys &&
            t.tag === a.number
        );
        const bAssigned = tagsMapArray.some(
          (t) =>
            t.area === showTagModalFor?.area &&
            t.disc === showTagModalFor?.disc &&
            t.sys === showTagModalFor?.sys &&
            t.tag === b.number
        );
        return aAssigned === bAssigned ? 0 : aAssigned ? 1 : -1;
      });
  }, [tags, searchQuery, typeFilter, assignmentFilter, tagsMapArray, showTagModalFor]);

  // Unique tag types for filter dropdown
  const uniqueTypes = useMemo(() => [...new Set(tags.map((tag) => tag.type))], [tags]);

  return (
    <>
      {/* Tag Assignment Modal */}
      <Modal
        show={!!showTagModalFor}
        onHide={() => setShowTagModalFor(null)}
        backdrop="static"
        keyboard={false}
      >
        <div className="Tag-Assign-dialog">
          <div className="title-dialog">
            <p className="text-light">Add Tags</p>
            <p className="text-light cross" onClick={() => setShowTagModalFor(null)}>
              ×
            </p>
          </div>

          {/* Filters */}
          <div className="d-flex gap-2 mb-3 ms-2 me-2 mt-4" style={{ fontSize: "11px" }}>
            <input
              className="form-control"
              type="text"
              placeholder="Search by tag number"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="form-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              {uniqueTypes.map((type, i) => (
                <option key={i} value={type}>{type}</option>
              ))}
            </select>
            <select
              className="form-select"
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>

          {/* Tag List with Select All */}
          <div className="tagListContainer" style={{ maxHeight: "300px", overflowY: "auto" }}>
            {isLoadingTags ? (
              <div className="text-center">
                <Spinner animation="border" size="sm" /> Loading tags...
              </div>
            ) : filteredTags.length === 0 ? (
              <p className="text-center text-light">No tags available for this project</p>
            ) : (
              <ul className="alltags" style={{ padding: "5px", listStyleType: "none", margin: "0" }}>
                {/* Select All Checkbox */}
                <li style={{ marginBottom: "10px", display: "flex", alignItems: "center" ,justifyContent: "space-between", }}>
                  <div className="d-flex">
                    <input
                      type="checkbox"
                      style={{ marginRight: "5px" }}
                      checked={filteredTags.length > 0 && filteredTags.every((tag) => selectedTags.includes(tag.number))}
                      onChange={(e) => (e.target.checked ? handleSelectAll() : handleClearAll())}
                    />
                    <p style={{ fontWeight: "bold" }}>Select All</p>
                  </div>
                </li>

                {/* Individual Tags */}
                {filteredTags.map((tag, index) => {
                  const isAssigned = tagsMapArray.some(
                    (t) =>
                      t.area === showTagModalFor?.area &&
                      t.disc === showTagModalFor?.disc &&
                      t.sys === showTagModalFor?.sys &&
                      t.tag === tag.number
                  );

                  return (
                    <li
                      key={index}
                      style={{
                        marginBottom: "5px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div className="d-flex">
                        <input
                          type="checkbox"
                          style={{ marginRight: "5px" }}
                          checked={selectedTags.includes(tag.number)}
                          onChange={(e) => handleTagSelection(tag.number, e.target.checked)}
                        />
                        <span>
                          {tag.number.length > 17 ? `${tag.number.slice(0, 17)}...` : tag.number}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <span style={{ color: "#888" }}>{tag.type}</span>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: isAssigned ? "green" : "red",
                            fontWeight: "bold",
                          }}
                        >
                          {isAssigned ? "Assigned" : "Unassigned"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer Buttons */}
          <div
            className="dialog-buttons"
            style={{ bottom: "0", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <p style={{ color: "#515CBC", cursor: "pointer" }} onClick={() => setShowRegisterTagModal(true)}>
              Register New Tag
            </p>
            <div className="btn1" onClick={handleAssignTags}>
              <p>{isLoading ? <Spinner animation="border" size="sm" /> : "Ok"}</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Register New Tag Modal */}
      <Modal show={showRegisterTagModal} onHide={() => setShowRegisterTagModal(false)} style={{ color: "#fff" }}>
        <Modal.Header closeButton style={{ backgroundColor: "#1a252f" }}>
          <Modal.Title>Register New Tag</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: "#1a252f" }}>
          <Form>
            <Form.Group className="mb-3" controlId="tagNumber">
              <Form.Label>Tag Number *</Form.Label>
              <Form.Control
                type="text"
                name="tagNumber"
                value={formData.tagNumber}
                onChange={handleChange}
                required
                pattern="[A-Za-z0-9\-]+"
                title="Only letters, numbers, and hyphens are allowed"
                style={{ backgroundColor: "#2d3b45", color: "#fff" }}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="parentTag">
              <Form.Label>Parent Tag</Form.Label>
              {isLoadingParentTags ? (
                <Spinner animation="border" size="sm" />
              ) : (
                <Form.Select
                  name="parentTag"
                  value={formData.parentTag}
                  onChange={handleChange}
                  style={{ backgroundColor: "#2d3b45", color: "#fff" }}
                >
                  <option value="">Select Parent Tag</option>
                  {parentTagOptions.map((tag) => (
                    <option key={tag.tagId} value={tag.tagNumber}>
                      {tag.tagNumber} - {tag.name}
                    </option>
                  ))}
                </Form.Select>
              )}
            </Form.Group>

            <Form.Group className="mb-3" controlId="name">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                style={{ backgroundColor: "#2d3b45", color: "#fff" }}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="type">
              <Form.Label>Type *</Form.Label>
              <Form.Select
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
                style={{ backgroundColor: "#2d3b45", color: "#fff" }}
              >
                <option value="">Choose type</option>
                <option value="Line">Line</option>
                <option value="Equipment">Equipment</option>
                <option value="Valve">Valve</option>
                <option value="Structural">Structural</option>
                <option value="Other">Other</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3" controlId="model">
              <Form.Label>Model</Form.Label>
              <Form.Control
                type="file"
                onChange={handleFileChange}
                accept=".stp,.step,.dwg,.pdf,.jpg,.png"
                style={{ backgroundColor: "#2d3b45", color: "#fff" }}
              />
              <Form.Text className="text-light">
                {formData.model
                  ? `${formData.model.name} (${(formData.model.size / 1024).toFixed(2)} KB)`
                  : "No file chosen (Max 10MB)"}
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: "#1a252f" }}>
          <Button
            variant="secondary"
            onClick={() => setShowRegisterTagModal(false)}
            style={{ backgroundColor: "#6c757d" }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleRegisterTag}
            disabled={isLoading}
            style={{ backgroundColor: "#007bff" }}
          >
            {isLoading ? (
              <>
                <Spinner as="span" animation="border" size="sm" /> Registering...
              </>
            ) : (
              "Register"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default TagEntityModal;