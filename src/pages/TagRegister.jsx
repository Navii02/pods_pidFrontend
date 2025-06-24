import React, { useState, useEffect } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';
// import "../styles/DocumentRegister.css";
import { GetTagDetails, RegisterTag } from '../services/TagApi';
import Alert from '../components/Alert';
import TagFileRegisterModal from '../components/TagFileRegisterModal';

const TagRegister = () => {
  const [formData, setFormData] = useState({
    tagNumber: '',
    parentTag: '',
    name: '',
    type: '',
    model: null,
    project_id: ''
  });

  const [parentTagOptions, setParentTagOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingParentTags, setIsLoadingParentTags] = useState(false);
    const [openModalBox, setOpenModalBox] = useState(false);
      const [customAlert, setCustomAlert] = useState(false);
        const [floatingPosition, setFloatingPosition] = useState({ x: 100, y: 100 });
  const [modalMessage, setModalMessage] = useState("");
    const [isMaximized, setIsMaximized] = useState(false);
     const [size, setSize] = useState({ width: 800, height: 500 });
       const [isMinimized, setIsMinimized] = useState(false);
         const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [fileNamePath, setFileNamePath] = useState([]);
      const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  
 

  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;
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
  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  // Close Window
  const onCloseFW = () => {
    // Reset floating window position and size
    setFloatingPosition({ x: 100, y: 100 });
    setSize({ width: 500, height: 500 });
    setIsMaximized(false);
    setIsMinimized(false);
    onClose();
  };
  // Toggle Maximize
  const toggleMaximize = () => {
    if (isMaximized) {
      setSize({ width: 800, height: 500 });
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

    // Start Resizing
  const startResize = (e) => {
    e.preventDefault();
    setResizing(true);
    setStartPosition({ x: e.clientX, y: e.clientY });
    setStartSize({ width: size.width, height: size.height });
  };
    const OpenModalFloatingWindow = () => {
    setOpenModalBox(true);
  };

  const onClose = () => {
    setOpenModalBox(false);
  };


  useEffect(() => {
    const fetchParentTags = async () => {
      if (!project?.projectId) return;
      
      try {
        setIsLoadingParentTags(true);
        const response = await GetTagDetails(project.projectId);
        if (response.status === 200) {
          setParentTagOptions(response.data);
        }
      } catch (error) {
        console.error("Error fetching parent tags:", error);
      } finally {
        setIsLoadingParentTags(false);
      }
    };

    fetchParentTags();
  }, [project?.projectId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      project_id: project?.projectId || ''
    }));
  };
 
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size > 10 * 1024 * 1024) { // 10MB limit example
     
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      model: file
    }));
  };

  const validateForm = () => {
    if (!project?.projectId) {
    setModalMessage("No project selected. Please select a project first.");
      return false;
    }
    
    if (!formData.tagNumber.trim()) {
      setModalMessage("TagNo & tagtype is mandatory");
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setIsLoading(true);
      const response = await RegisterTag(formData);
      if (response.status === 201) {
      setModalMessage("Tag registered successfully!");
        // Reset form
        setFormData({
          tagNumber: '',
          parentTag: '',
          name: '',
          type: '',
          model: null,
          project_id: project?.projectId || ''
        });
      }
    } catch (error) {
      console.error("Error during tag registration:", error);
      const errorMessage = error.response?.data?.message || 
                         error.response?.data?.error || 
                         'An error occurred while registering the tag.';
              setModalMessage(errorMessage);

    } finally {
      setIsLoading(false);
    }
  };

 

  if (!project) {
    return (
      <div className="document-registration-container">
        <div className="document-registration-wrapper">
          <h2>Tag Registration</h2>
          <div className="alert alert-danger">
            No project selected. Please select a project first.
          </div>
        </div>
      </div>
    );
  }

  return (
   <div className='w-100' >
  <div id="bulkImportDiv">
    <div className="page">
      <section className="page-section">
        <div className="row">
          <h4>Tag Registration</h4>
        </div>
      </section>
      <hr />
      <section className="page-section">
        <Form onSubmit={handleSubmit} className="dialog-input" style={{ fontSize: "13px", lineHeight: "30px" }}>
          <div className="row">
            <div className="col-md-6">
              <Form.Group className="mb-3" controlId="tagNumber">
                <Form.Label>
                  Tag number<span style={{ fontSize: "11px" }}>*</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  className='bg-white'
                  name="tagNumber"
                  value={formData.tagNumber}
                  onChange={handleChange}
                  required
                  pattern="[A-Za-z0-9\-]+"
                  title="Only letters, numbers and hyphens are allowed"
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="parentTag">
                <Form.Label>Parent Tag:</Form.Label>
                {isLoadingParentTags ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  <Form.Select
                    name="parentTag"
                       className='bg-white text-dark'
                       
                    value={formData.parentTag}
                    onChange={handleChange}
                    style={{ width: "100%" }}
                  >
                    <option value="">Select Parent Tag</option>
                    {parentTagOptions.map(tag => (
                      <option key={tag.id} value={tag.tagNumber}>
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
                     className='bg-white'
                  value={formData.name}
                  onChange={handleChange}
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="type">
                <Form.Label>
                  Type<span style={{ fontSize: "11px" }}>*</span>
                </Form.Label>
                <Form.Select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                     className='bg-white text-dark'
                  required
                  style={{ width: "100%" }}
                >
                  <option value="" disabled>Choose type</option>
                  <option value="Line">Line</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Valve">Valve</option>
                  <option value="Structural">Structural</option>
                  <option value="Other">Other</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3" controlId="model">
                <Form.Label>Model</Form.Label>
                <br />
                <Button
                  variant="light"
                  className="mt-1"
                  style={{ fontSize: "13px" }}
                   onClick={OpenModalFloatingWindow}
                >
                  Choose File
                </Button>
                <br />
                <p style={{ fontSize: "13px" }}>
                  {formData.model 
                    ? formData.model.name
                    : ""}
                </p>
              </Form.Group>
            </div>
          </div>
          <hr />
          <Button 
            variant="light"
            type="submit"
            style={{ fontSize: "12px" }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spinner as="span" animation="border" size="sm" /> Registering...
              </>
            ) : 'Register'}
          </Button>
        </Form>
        
      
      </section>
    </div>
  </div>
      {customAlert && (
        <Alert
          message={modalMessage}
          onAlertClose={() => setCustomAlert(false)}
        />
      )}

      {openModalBox && (
        <div
          className="floating-window"
          style={{
            position: "fixed",
            zIndex: 2147483647,
            // transform: "translateZ(0)",
            // willChange: "transform",
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
            <span>Edit Modal</span>
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
              
              }}
            >
              <TagFileRegisterModal
                setOpenModalBox={setOpenModalBox}
                setLoading={setIsLoading}
                fileNamePath={fileNamePath}
                setFileNamePath={setFileNamePath}
              />
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
</div>
  );
};
const buttonStyle = {
  background: "transparent",
  color: "white",
  border: "none",
  cursor: "pointer",
  fontSize: "16px",
  marginRight: "8px",
};

export default TagRegister;