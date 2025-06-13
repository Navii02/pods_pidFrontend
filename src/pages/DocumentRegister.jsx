import React, { useRef, useState } from "react";
import "../styles/DocumentRegister.css";
import { saveDocument } from "../services/CommonApis";
import AlertModal from "../components/AlertModal";

function Documentregister() {
  const [documentNumber, setDocumentNumber] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("");
  const [file, setFile] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: "success", message: "" });

  const fileInputRef = useRef();

  const docs = {
    types: [
      { code: "AA", name: "Accounting/Budget" },
      { code: "CA", name: "Analysis, test and calculation" },
      { code: "DS", name: "Data sheets" },
      { code: "FD", name: "Project design criteria and philosophies" },
      { code: "iKA", name: "Interactive procedures" },
      { code: "iXB", name: "Smart P&ID" },
      { code: "iXX", name: "H-Doc" },
      { code: "KA", name: "Procedures" },
      { code: "LA", name: "List/Registers" },
      { code: "MA", name: "Equipment user manual (ref. NS5820)" },
      { code: "MB", name: "Operating and maintenance instructions" },
      { code: "MC", name: "Spare parts list" },
      { code: "PA", name: "Purchase orders" },
      { code: "PB", name: "Blanket order/frame agreement" },
      { code: "PD", name: "Contract" },
      { code: "RA", name: "Reports" },
      { code: "RD", name: "System design reports and system user manuals" },
      { code: "RE", name: "DFI (Design - Fabrication - Installation) resumes" },
      { code: "SA", name: "Specifications & Standards" },
      { code: "TA", name: "Plans/schedules" },
      { code: "TB", name: "Work plan" },
      { code: "TE", name: "Estimates" },
      { code: "TF", name: "Work package" },
      { code: "VA", name: "Manufacturing/Fabrication and verifying documentation" },
      { code: "VB", name: "Certificates" },
      { code: "XA", name: "Flow diagrams" },
      { code: "XB", name: "Pipe and instrument diagram (P&ID)" },
      { code: "XC", name: "Duct and instrument diagrams (D&ID)" },
      { code: "XD", name: "General arrangement" },
      { code: "XE", name: "Layout drawings" },
      { code: "XF", name: "Location drawings (plot plans)" },
      { code: "XG", name: "Structural information" },
      { code: "XH", name: "Free span calculation" },
      { code: "XI", name: "System topology and block diagrams" },
      { code: "XJ", name: "Single line diagrams" },
      { code: "XK", name: "Circuit diagrams" },
      { code: "XL", name: "Logic diagrams" },
      { code: "XM", name: "Level diagrams" },
      { code: "XN", name: "Isometric drawings" },
      { code: "XO", name: "Piping supports" },
      { code: "XQ", name: "Pneumatic/hydraulic connection drawings" },
      { code: "XR", name: "Cause and effect" },
      { code: "XS", name: "Detail cross sectional drawings" },
      { code: "XT", name: "Wiring diagrams" },
      { code: "XU", name: "Loop diagram" },
      { code: "XX", name: "Drawings - miscellaneous" },
      { code: "ZA", name: "EDP documentation" },
    ],
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSelectType = (docType) => {
    setType(docType.code);
    setIsModalOpen(false);
  };

  const handleCloseAlert = () => {
    setAlert({ show: false, type: "success", message: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!documentNumber || !type) {
      setAlert({
        show: true,
        type: "error",
        message: "Please fill in all required fields.",
      });
      return;
    }

    const projectString = sessionStorage.getItem("selectedProject");
    const project = projectString ? JSON.parse(projectString) : null;

    const formData = new FormData();
    formData.append("documentNumber", documentNumber);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("type", type);
    formData.append("projectId", project?.projectId);
    if (file) {
      formData.append("file", file);
    }

    try {
      const response = await saveDocument(formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.status === 200 || response.status === 201) {
        setAlert({
          show: true,
          type: "success",
          message: "Document registered successfully!",
        });
        setDocumentNumber("");
        setTitle("");
        setDescription("");
        setType("");
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        setAlert({
          show: true,
          type: "error",
          message: "Something went wrong while registering the document.",
        });
      }
    } catch (error) {
      console.error("Error registering document:", error);
      setAlert({
        show: true,
        type: "error",
        message: "Error occurred while registering the document. Please try again.",
      });
    }
  };

  return (
    <div className="document-registration-container">
      <div className="document-registration-wrapper">
        <h2>Document registration</h2>
         <form onSubmit={handleSubmit} className="document-registration-form">
          <div className="mb-3">
            <label htmlFor="documentNumber" className="form-label">
              Document number <span className="required">*</span>
            </label>
            <input
              type="text"
              id="documentNumber"
              className="form-control"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="title" className="form-label">
              Title
            </label>
            <input
              type="text"
              id="title"
              className="form-control"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label htmlFor="description" className="form-label">
              Description
            </label>
            <textarea
              id="description"
              className="form-control"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
            />
          </div>

          <div className="mb-3">
            <label htmlFor="type" className="form-label">
              Type <span className="required">*</span>
            </label>
            <select
              id="type"
              className="form-select custom-select"
              value={type}
              onChange={(e) => setType(e.target.value)}
              required
            >
              <option value="">Select type</option>
              {docs.types.map((docType) => (
                <option key={docType.code} value={docType.code}>
                  {docType.code} - {docType.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label htmlFor="file" className="form-label">
              Document file
            </label>
            <input
              type="file"
              id="file"
              className="form-control"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.zip,.svg"
                ref={fileInputRef} 
            />
          </div>

          <button type="submit" className="btn register-button">
            Register
          </button>
        </form>

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
                <h3 className="tag-modal-title">Select Document Type</h3>
                <button
                  className="close-button"
                  onClick={() => setIsModalOpen(false)}
                  aria-label="Close document type selection modal"
                >
                  ×
                </button>
              </div>

              <div className="tag-modal-body">
                {docs.types.length > 0 ? (
                  <ul className="tag-list" role="listbox" aria-label="Available document types">
                    {docs.types.map((docType) => (
                      <li
                        key={docType.code}
                        className="tag-item"
                        onClick={() => handleSelectType(docType)}
                        role="option"
                        aria-selected={type === docType.code}
                      >
                        {docType.code} - {docType.name}
                        {type === docType.code && <span className="selected-indicator">✓</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-state">No document types available.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {alert.show && (
          <AlertModal
            type={alert.type}
            message={alert.message}
            onClose={handleCloseAlert}
            showCloseButton={true}
            closeButtonText="OK"
          />
        )}
      </div>
    </div>
  );
}

export default Documentregister;