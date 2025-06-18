import React, { useEffect, useState } from "react";
import { Modal, Button, Form, InputGroup, FormControl, Spinner } from "react-bootstrap";
import { GetEntities, RegisterTagsforsystem } from "../../services/TreeManagementApi";
import { RegisterTag } from "../../services/TagApi";

const TagEntityModal = ({ showTagModalFor, setShowTagModalFor, selectedProject,tagsMap }) => {
  const [showRegisterTagModal, setShowRegisterTagModal] = useState(false);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [parentTagOptions, setParentTagOptions] = useState([]);
  const [isLoadingParentTags, setIsLoadingParentTags] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    tagNumber: '',
    parentTag: '',
    name: '',
    type: '',
    model: null,
    project_id: selectedProject?.projectId || ''
  });

  useEffect(() => {
    if (selectedProject?.projectId) {
      fetchProjectTags();
      fetchParentTags();
    }
  }, [selectedProject]);

  const fetchProjectTags = async () => {
    try {
      const response = await GetEntities("tag", selectedProject.projectId);
      if (response.status === 200) {
        setTags(response.data.tags || []);
      }
    } catch (error) {
      console.error("Failed to fetch tags", error);
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
    } finally {
      setIsLoadingParentTags(false);
    }
  };

  const handleTagSelection = (tagId, isChecked) => {
    setSelectedTags(isChecked ? [...selectedTags, tagId] : selectedTags.filter(id => id !== tagId));
  };

  const handleSelectAll = () => {
    const filtered = tags
      .filter(tag => tag.name?.toLowerCase().includes(searchTerm?.toLowerCase()))
      .filter(tag => (filterType ? tag.type === filterType : true));
    setSelectedTags(filtered.map(tag => tag.tagId));
  };

  const handleClearAll = () => {
    setSelectedTags([]);
  };

  const handleAssignTags = async () => {
    if (!showTagModalFor || selectedTags.length === 0) return;

    try {
      for (const tagId of selectedTags) {
        const tag = tags.find(t => t.tagId === tagId);
        if (!tag) continue;

        const payload = {
          project_id: selectedProject.projectId,
          area: showTagModalFor.area,
          disc: showTagModalFor.disc,
          sys: showTagModalFor.sys,
          code: tag.number,
          name: tag.name
        };

        const response = await RegisterTagsforsystem(payload);
        if (response.status !== 200) {
          throw new Error(`Failed to assign tag: ${tag.name}`);
        }
      }

      alert("Tags assigned successfully!");
      setShowTagModalFor(null);
      setSelectedTags([]);
    } catch (error) {
      console.error("Failed to assign tags", error);
      alert(`Failed to assign tags: ${error.message}`);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value, project_id: selectedProject?.projectId || '' }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size > 10 * 1024 * 1024) {
      alert('Please select a file smaller than 10MB');
      return;
    }
    setFormData(prev => ({ ...prev, model: file }));
  };

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

  const handleRegisterTag = async () => {
    if (!validateForm()) return;

    try {
      setIsLoading(true);
      const response = await RegisterTag(formData);
      if (response.status === 201) {
        alert("Tag registered successfully!");
        setFormData({
          tagNumber: '',
          parentTag: '',
          name: '',
          type: '',
          model: null,
          project_id: selectedProject?.projectId || ''
        });
        setShowRegisterTagModal(false);
        await fetchProjectTags();
      }
    } catch (error) {
      console.error("Error during tag registration:", error);
      const errorMessage = error.response?.data?.message ||
                           error.response?.data?.error ||
                           "An error occurred while registering the tag.";
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };
  console.log(showTagModalFor,tagsMap);
const [searchQuery, setSearchQuery] = useState(''); 
   const [typeFilter, setTypeFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  // const filteredTags = tags
  //   .filter(tag => tag.name?.toLowerCase().includes(searchTerm?.toLowerCase()))
  //   .filter(tag => (filterType ? tag.type === filterType : true));
  // const uniqueTypes = [...new Set(tags.map(tag => tag.type))];

  const tagsMapArray = Array.isArray(tagsMap)
  ? tagsMap
  : Array.from(tagsMap.values ? tagsMap.values() : []);

const filteredTags = tags
    .filter(tag =>
      tag.number.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(tag =>
      typeFilter === 'all' ? true : tag.type === typeFilter
    )
    .filter(tag => {
      const isAssigned = tagsMapArray.some(t =>
        t.area === showTagModalFor.area &&
        t.disc ===  showTagModalFor.disc &&
        t.sys ===  showTagModalFor.sys &&
        t.tag === tag.number
      );
      if (assignmentFilter === 'assigned') return isAssigned;
      if (assignmentFilter === 'unassigned') return !isAssigned;
      return true;
    })
    .sort((a, b) => {
      const aAssigned = tagsMapArray.some(t =>
       t.area === showTagModalFor.area &&
        t.disc ===  showTagModalFor.disc &&
        t.sys ===  showTagModalFor.sys &&
        t.tag === a.number
      );
      const bAssigned = tagsMapArray.some(t =>
        t.area === showTagModalFor.area &&
        t.disc ===  showTagModalFor.disc &&
        t.sys ===  showTagModalFor.sys &&
        t.tag === b.number
      );
      return aAssigned === bAssigned ? 0 : aAssigned ? 1 : -1;
    });

  const uniqueTypes = [...new Set(tags.map(tag => tag.type))];

  return (
    <>
      {/* Tag Assignment Modal */}
      <Modal show={!!showTagModalFor} onHide={() => setShowTagModalFor(null)}  backdrop="static"
  keyboard={false}>

    <div className="Tag-Assign-dialog">
      <div className="title-dialog">
      <p className="text-light">Add Tags</p>
      <p className="text-light cross" onClick={() => setShowTagModalFor(null)}>
        &times;
      </p>
    </div>
   {/* Filters */}
        <div className="d-flex gap-2 mb-3 ms-2 me-2 mt-4" style={{fontSize:'11px'}}>
          <input
            className="form-control"
            type="text"
            placeholder="Name"
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
    <div
      className="tagListContainer"
      style={{ maxHeight: "300px", overflowY: "auto" }}
    >
      <ul
        className="alltags"
        style={{ padding: "5px", listStyleType: "none", margin: "0" }}
      >
        {/* SELECT ALL CHECKBOX */}
        {filteredTags.length > 0 && (
          <li
            style={{
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <div>
              <input
                type="checkbox"
                style={{ marginRight: "5px" }}
                checked={
                  filteredTags.length > 0 &&
                  filteredTags.every((tag) =>
                    selectedTags.includes(tag.number)
                  )
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    const allFilteredTagNumbers = filteredTags.map(
                      (tag) => tag.number
                    );
                    const newSelected = [
                      ...new Set([...selectedTags, ...allFilteredTagNumbers]),
                    ];
                    setSelectedTags(newSelected);
                  } else {
                    const remainingSelected = selectedTags.filter(
                      (num) =>
                        !filteredTags.some((tag) => tag.number === num)
                    );
                    setSelectedTags(remainingSelected);
                  }
                }}
              />
              <span style={{ fontWeight: "bold" }}>Select All</span>
            </div>
          </li>
        )}

        {/* Individual Tags with Assignment Indicator */}
        {filteredTags.map((tag, index) => {
          const isAssigned = tags.some(t =>
           
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
              <div>
                <input
                  type="checkbox"
                  style={{ marginRight: "5px" }}
                  checked={selectedTags.includes(tag.tagId)}
                   onChange={(e) => handleTagSelection(tag.tagId, e.target.checked)}
                />
                {/* onChange={() => toggleTagSelection(tag.number)} */}
                <span>
                  {tag.number.length > 17
                    ? tag.number.slice(0, 17) + "..."
                    : tag.number}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                }}
              >
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
    </div>

    {/* Footer Buttons */}
    <div
      className="dialog-buttons"
      style={{
        bottom: "0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <p
        style={{ color: "#515CBC", cursor: "pointer" }}
       onClick={() => setShowRegisterTagModal(true)}
      >
        Register New Tag
      </p>
      <div className="btn1" onClick={handleAssignTags}>
        <p>Ok</p>
      </div>
    </div>
        {/* <Modal.Body style={{ backgroundColor: '#1a252f' }}>
          <InputGroup className="mb-3">
            <FormControl
              placeholder="Search tags by name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ backgroundColor: '#2d3b45', color: '#fff' }}
            />
          </InputGroup>
          <Form.Group className="mb-3">
            <Form.Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ backgroundColor: '#2d3b45', color: '#fff' }}
            >
              <option value="">All Types</option>
              <option value="Line">Line</option>
              <option value="Equipment">Equipment</option>
              <option value="Valve">Valve</option>
              <option value="Structural">Structural</option>
              <option value="Other">Other</option>
            </Form.Select>
          </Form.Group>

          <div className="d-flex justify-content-between mb-3">
            <div>
              <Button variant="outline-light" size="sm" onClick={handleSelectAll} className="me-2">Select All</Button>
              <Button variant="outline-light" size="sm" onClick={handleClearAll}>Clear All</Button>
            </div>
            <Button variant="outline-primary" size="sm" onClick={() => setShowRegisterTagModal(true)}>Register New Tag</Button>
          </div>

          {filteredTags.length > 0 ? (
            <Form>
              {filteredTags.map(tag => (
                <Form.Check
                  key={tag.tagId}
                  type="checkbox"
                  id={`tag-${tag.tagId}`}
                  label={`${tag.name} (${tag.type || 'Unknown'})`}
                  checked={selectedTags.includes(tag.tagId)}
                  onChange={(e) => handleTagSelection(tag.tagId, e.target.checked)}
                  style={{ color: '#fff' }}
                />
              ))}
            </Form>
          ) : (
            <p>No tags available for this project</p>
          )}
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: '#1a252f' }}>
          <Button variant="secondary" onClick={() => setShowTagModalFor(null)} style={{ backgroundColor: '#6c757d' }}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAssignTags} style={{ backgroundColor: '#007bff' }}>
            Assign Tags
          </Button>
        </Modal.Footer> */}
            </div>

      </Modal>

      {/* Register New Tag Modal */}
      <Modal show={showRegisterTagModal} onHide={() => setShowRegisterTagModal(false)} style={{ color: '#fff' }}>
        <Modal.Header closeButton style={{ backgroundColor: '#1a252f' }}>
          <Modal.Title>Register New Tag</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ backgroundColor: '#1a252f' }}>
          <Form>
            <Form.Group className="mb-3" controlId="tagNumber">
              <Form.Label>Tag Number *</Form.Label>
              <Form.Control type="text" name="tagNumber" value={formData.tagNumber} onChange={handleChange}
                required pattern="[A-Za-z0-9\-]+" title="Only letters, numbers and hyphens are allowed"
                style={{ backgroundColor: '#2d3b45', color: '#fff' }} />
            </Form.Group>

            <Form.Group className="mb-3" controlId="parentTag">
              <Form.Label>Parent Tag</Form.Label>
              {isLoadingParentTags ? (
                <Spinner animation="border" size="sm" />
              ) : (
                <Form.Select name="parentTag" value={formData.parentTag} onChange={handleChange}
                  style={{ backgroundColor: '#2d3b45', color: '#fff' }}>
                  <option value="">Select Parent Tag</option>
                  {parentTagOptions.map(tag => (
                    <option key={tag.tagId} value={tag.tagNumber}>
                      {tag.tagNumber} - {tag.name}
                    </option>
                  ))}
                </Form.Select>
              )}
            </Form.Group>

            <Form.Group className="mb-3" controlId="name">
              <Form.Label>Name</Form.Label>
              <Form.Control type="text" name="name" value={formData.name} onChange={handleChange}
                style={{ backgroundColor: '#2d3b45', color: '#fff' }} />
            </Form.Group>

            <Form.Group className="mb-3" controlId="type">
              <Form.Label>Type *</Form.Label>
              <Form.Select name="type" value={formData.type} onChange={handleChange} required
                style={{ backgroundColor: '#2d3b45', color: '#fff' }}>
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
              <Form.Control type="file" onChange={handleFileChange} accept=".stp,.step,.dwg,.pdf,.jpg,.png"
                style={{ backgroundColor: '#2d3b45', color: '#fff' }} />
              <Form.Text className="text-light">
                {formData.model
                  ? `${formData.model.name} (${(formData.model.size / 1024).toFixed(2)} KB)`
                  : 'No file chosen (Max 10MB)'}
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer style={{ backgroundColor: '#1a252f' }}>
          <Button variant="secondary" onClick={() => setShowRegisterTagModal(false)} style={{ backgroundColor: '#6c757d' }}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleRegisterTag} disabled={isLoading} style={{ backgroundColor: '#007bff' }}>
            {isLoading ? (
              <>
                <Spinner as="span" animation="border" size="sm" /> Registering...
              </>
            ) : 'Register'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default TagEntityModal;
