import React, { useState, useEffect } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';
import "../styles/DocumentRegister.css";
import { GetTagDetails, RegisterTag } from '../services/TagApi';
import CustomModal from '../components/AlertModal';

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
  
  const [modalConfig, setModalConfig] = useState({
    show: false,
    type: 'success',
    title: '',
    message: ''
  });

  const projectString = sessionStorage.getItem("selectedProject");
  const project = projectString ? JSON.parse(projectString) : null;

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
      setModalConfig({
        show: true,
        type: 'error',
        title: 'File Too Large',
        message: 'Please select a file smaller than 10MB'
      });
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      model: file
    }));
  };

  const validateForm = () => {
    if (!project?.projectId) {
      setModalConfig({
        show: true,
        type: 'error',
        title: 'Error',
        message: 'No project selected. Please select a project first.'
      });
      return false;
    }
    
    if (!formData.tagNumber.trim()) {
      setModalConfig({
        show: true,
        type: 'error',
        title: 'Validation Error',
        message: 'Tag number is required'
      });
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
        setModalConfig({
          show: true,
          type: 'success',
          title: 'Registration Complete',
          message: 'Tag registered successfully!'
        });
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
      setModalConfig({
        show: true,
        type: 'error',
        title: 'Error',
        message: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, show: false }));
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
    <div className="document-registration-container">
      <div className="document-registration-wrapper">
        <h2>Tag Registration</h2>
        <Form onSubmit={handleSubmit} className="document-registration-form">
          <Form.Group className="mb-3" controlId="tagNumber">
            <Form.Label className="form-label">
              Tag number<span className="required">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              name="tagNumber"
              value={formData.tagNumber}
              onChange={handleChange}
              required
              className="form-control"
              pattern="[A-Za-z0-9\-]+"
              title="Only letters, numbers and hyphens are allowed"
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="parentTag">
            <Form.Label className="form-label">Parent Tag</Form.Label>
            {isLoadingParentTags ? (
              <Spinner animation="border" size="sm" />
            ) : (
              <Form.Select
                name="parentTag"
                value={formData.parentTag}
                onChange={handleChange}
                className="form-select custom-select"
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
            <Form.Label className="form-label">Name</Form.Label>
            <Form.Control
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="form-control"
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="type">
            <Form.Label className="form-label">
              Type<span className="required">*</span>
            </Form.Label>
            <Form.Select
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
              className="form-select custom-select"
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
            <Form.Label className="form-label">Model</Form.Label>
            <Form.Control
              type="file"
              onChange={handleFileChange}
              className="form-control"
              accept=".stp,.step,.dwg,.pdf,.jpg,.png"
            />
            <Form.Text className="text-light">
              {formData.model 
                ? `${formData.model.name} (${(formData.model.size / 1024).toFixed(2)} KB)`
                : 'No file chosen '}
            </Form.Text>
          </Form.Group>

          <Button 
            type="submit" 
            className="register-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spinner as="span" animation="border" size="sm" /> Registering...
              </>
            ) : 'Register'}
          </Button>
        </Form>
        
        {modalConfig.show && (
          <CustomModal 
            type={modalConfig.type}
            title={modalConfig.title}
            message={modalConfig.message}
            onClose={closeModal}
          />
        )}
      </div>
    </div>
  );
};

export default TagRegister;