import React, { useState, useEffect } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';
import { GetTagDetails, RegisterTag } from '../services/TagApi';
import Alert from '../components/Alert';
import TagFileRegisterModal from '../components/TagFileRegisterModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus, faTimes, faWindowMaximize, faWindowRestore } from '@fortawesome/free-solid-svg-icons';

const TagRegister = () => {
  const [formData, setFormData] = useState({
    tagNumber: '',
    parentTag: '',
    name: '',
    type: '',
    model: '',
    project_id: ''
  });

  const [parentTagOptions, setParentTagOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingParentTags, setIsLoadingParentTags] = useState(false);
  const [openModalBox, setOpenModalBox] = useState(false);
  const [customAlert, setCustomAlert] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [floatingPosition, setFloatingPosition] = useState({ x: 100, y: 100 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [size, setSize] = useState({ width: 800, height: 500 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [file, setFile] = useState("");
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });

  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;

  // Handle dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (dragging) {
        setFloatingPosition({
          x: Math.max(0, Math.min(e.clientX - offset.x, window.innerWidth - size.width)),
          y: Math.max(0, Math.min(e.clientY - offset.y, window.innerHeight - size.height)),
        });
      }
      if (resizing) {
        const deltaX = e.clientX - startPosition.x;
        const deltaY = e.clientY - startPosition.y;
        setSize({
          width: Math.max(startSize.width + deltaX, 300),
          height: Math.max(startSize.height + deltaY, 200),
        });
      }
    };

    const handleMouseUp = () => {
      setDragging(false);
      setResizing(false);
    };

    if (dragging || resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, resizing, offset, startPosition, startSize]);

  // Ensure floating window stays within viewport on resize
  useEffect(() => {
    const handleResize = () => {
      if (!isMaximized) {
        setFloatingPosition({
          x: Math.min(floatingPosition.x, window.innerWidth - size.width),
          y: Math.min(floatingPosition.y, window.innerHeight - size.height),
        });
      } else {
        setSize({
          width: window.innerWidth - 60,
          height: window.innerHeight - 20,
        });
        setFloatingPosition({ x: 10, y: 10 });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [floatingPosition, size, isMaximized]);

  // Fetch parent tags
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
        setModalMessage("Failed to load parent tags.");
        setCustomAlert(true);
      } finally {
        setIsLoadingParentTags(false);
      }
    };

    fetchParentTags();
  }, [project?.projectId]);

  const startDrag = (e) => {
    if (!isMaximized) {
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
      setOffset({
        x: e.clientX - floatingPosition.x,
        y: e.clientY - floatingPosition.y,
      });
    }
  };

  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);
    setStartPosition({ x: e.clientX, y: e.clientY });
    setStartSize({ width: size.width, height: size.height });
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

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

  const onCloseFW = () => {
    setOpenModalBox(false);
    setFloatingPosition({ x: 100, y: 100 });
    setSize({ width: 800, height: 500 });
    setIsMaximized(false);
    setIsMinimized(false);
  };

  const OpenModalFloatingWindow = () => {
    setOpenModalBox(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      project_id: project?.projectId || ''
    }));
  };

  const validateForm = () => {
    if (!project?.projectId) {
      setModalMessage("No project selected. Please select a project first.");
      setCustomAlert(true);
      return false;
    }
    if (!formData.tagNumber.trim()) {
      setModalMessage("TagNo & tagtype is mandatory");
      setCustomAlert(true);
      return false;
    }
    if (!formData.type) {
      setModalMessage("Tag type is mandatory");
      setCustomAlert(true);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!validateForm()) return;

    try {
      setIsLoading(true);
      const tagData = { ...formData, model: file };
      const response = await RegisterTag(tagData);
      if (response.status === 201) {
        setModalMessage("Tag registered successfully!");
        setCustomAlert(true);
        setFormData({
          tagNumber: '',
          parentTag: '',
          name: '',
          type: '',
          model: '',
          project_id: project?.projectId || ''
        });
        setFile("");
      }
    } catch (error) {
      console.error("Error during tag registration:", error);
      const errorMessage = error.response?.data?.message ||
                          error.response?.data?.error ||
                          'An error occurred while registering the tag.';
      setModalMessage(errorMessage);
      setCustomAlert(true);
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
    <div className='w-100'>
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
                      title="Only letters, numbers, and hyphens are allowed"
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
                      {file || "No file selected"}
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
            zIndex: 9999,
            top: floatingPosition.y,
            left: floatingPosition.x,
            width: size.width,
            height: isMinimized ? "40px" : size.height,
            background: "white",
            border: "1px solid #ccc",
            marginBottom:"20px",
            boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
            borderRadius: "8px",
            overflow: "hidden",
            userSelect: "none",
            WebkitUserSelect: "none",
            MozUserSelect: "none",
            msUserSelect: "none",
          }}
        >
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
            }}
            onMouseDown={startDrag}
          >
            <span>File Converter</span>
            <div>
              <button onClick={toggleMinimize} style={buttonStyle}>
                <FontAwesomeIcon icon={faMinus}/>
              </button>
              <button onClick={toggleMaximize} style={buttonStyle}>
                {isMaximized ? <FontAwesomeIcon icon={faWindowRestore} /> : <FontAwesomeIcon icon={faWindowMaximize} />}
              </button>
              <button onClick={onCloseFW} style={buttonStyle}>
           <FontAwesomeIcon icon={faTimes}/>
              </button>
            </div>
          </div>

          {!isMinimized && (
            <div
              className="floating-content"
              style={{
                height: "calc(100% - 40px)",
                overflowY: "auto",
              }}
            >
              <TagFileRegisterModal
                setOpenModalBox={setOpenModalBox}
                setLoading={setIsLoading}
                file={file}
                setFile={setFile}
              />
            </div>
          )}

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
                zIndex: 10000,
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