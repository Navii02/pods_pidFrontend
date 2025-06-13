import { commonApi } from "./apiStructure";
import { url } from "./Url";

export const saveProject = async (newproject) => {
  const projectName = newproject.projectName;
  if (!projectName) {
    throw new Error("Invalid project name");
  }

  try {
    const response = await commonApi(
      "POST",
      `${url}/api/createproject`,
      newproject
    );
    return response;
  } catch (error) {
    console.error("Project creation failed:", error);
    throw error;
  }
};

export const getProjects = async () => {
  try {
    const response = await commonApi("GET", `${url}/api/getproject`);
    console.log(response);
    return response;
  } catch (error) {
    throw error;
  }
};

export const saveDocument = async (data, headers) => {
  try {
    const response = await commonApi(
      "POST",
      `${url}/api/savedocument`,
      data,
      headers
    );
    return response;
  } catch (error) {
    throw error;
  }
};

export const updateProject = async (project) => {
  const { projectId, projectName, projectNumber, description: projectDescription, projectPath } = project;
  if (!projectId || !projectName) {
    throw new Error("Project ID and project name are required");
  }

  try {
    const response = await commonApi(
      "PUT",
      `${url}/api/updateproject`,
      {
        projectId,
        projectName,
        projectNumber,
        projectDescription,
        projectPath,
      }
    );
    return response;
  } catch (error) {
    console.error("Project update failed:", error);
    throw error;
  }
};

export const deleteProject = async (projectId) => {
  if (!projectId) {
    throw new Error("Project ID is required");
  }

  try {
    const response = await commonApi(
      "DELETE",
      `${url}/api/deleteproject`,
      { projectId }
    );
    return response;
  } catch (error) {
    console.error("Project deletion failed:", error);
    throw error;
  }
};

export const getDocumentsdetails = async (projectId) => {
 // console.log(projectId);

  try {
    const response = await commonApi(
      "GET",
      `${url}/api/getdocumentsdetails?projectId=${projectId}`
    );
   // console.log(response);
    
    return response;
  } catch (error) {
    console.error("Failed to fetch document details:", error);
    throw error;
  }
};
