import { commonApi } from "./apiStructure";
import { url } from "./Url";

export const RegisterTag = async (formData) => {
  try {
    const response = await commonApi("POST", `${url}/api/addtag`, formData);

    return response;
  } catch (error) {
    throw error;
  }
};
 export const SaveUpdatedTagFile = async(files)=>{
   try {
      const response = await commonApi('POST',`${url}/api/save-updated-tagfile`,files)
       return response
   } catch (error) {
      throw error
   }
 }
export const GetTagDetails = async (id) => {
  try {
    const response = await commonApi("GET", `${url}/api/get-alltags/${id}`);
    return response;
  } catch (error) {
    throw error;
  }
};

export const getTagDetailsFromFileName = async (projectId, parentFileName) => {
  try {
    const response = await commonApi(
      "GET",
      `${url}/api/get-mesh-tag-by-project/${projectId}/${encodeURIComponent(
        parentFileName
      )}`
    );
    return response;
  } catch (error) {
    throw error;
  }
};

export const deleteTag = async (TagId) => {
  try {
    const response = await commonApi(
      "DELETE",
      `${url}/api/delete-tag/${TagId}`
    );
    return response;
  } catch (error) {
    throw error;
  }
};

export const updateTags = async (TagId, data) => {
  try {
    const response = await commonApi(
      "PUT",
      `${url}/api/update-tag/${TagId}`,
      data
    );
    return response;
  } catch (error) {
    throw error;
  }
};

export const AssignTag = async (tagId, uniqueIds, fileId) => {
  try {
    const data = { tagId, uniqueIds, fileId };
    const response = await commonApi("POST", `${url}/api/assign-tag`, data);
    return response;
  } catch (error) {
    throw error;
  }
};

export const getAssignedTags = async (fileId) => {
  try {
    const response = await commonApi(
      "GET",
      `${url}/api/get-assigned-tags/${fileId}`
    );
    return response;
  } catch (error) {
    throw error;
  }
};

export const getdocumentsbyTags = async (tagId) => {
  try {
    const response = await commonApi(
      "GET",
      `${url}/api/tags/${tagId}/documents`
    );
    return response;
  } catch (error) {
    throw error;
  }
};

//Linelist

export const getLineList = async (id) => {
  try {
    const response = await commonApi("GET", `${url}/api/getline/${id}`);
    return response;
  } catch (error) {
    throw error;
  }
};

export const getLineDetails = async (id, tagId) => {
  try {
    const response = await commonApi(
      "GET",
      `${url}/api/getline-details/${id}/${tagId}`
    );
    return response;
  } catch (error) {
    throw error;
  }
};

export const saveimportedLineList = async (data) => {};
export const EditLinelist = async (data) => {
  try {
    const response = await commonApi("PUT", `${url}/api/edit-line-list`, data);
    return response;
  } catch (error) {
    throw error;
  }
};
export const deletelineList = async (projectId,tagId) => {
  try {
    const response = await commonApi(
      "PUT",
      `${url}/api/delete-line-list`,{projectId,tagId}
    );
    return response;
  } catch (error) {
    throw error;
  }
};
//EquipmentList

export const getequipmentList = async (id) => {
  try {
    const response = await commonApi("GET", `${url}/api/getequipment/${id}`);
    return response;
  } catch (error) {
    throw error;
  }
};

export const getEquipmentDetails = async (id, tagId) => {
  try {
    const response = await commonApi(
      "GET",
      `${url}/api/getequipment-details/${id}/${tagId}`
    );
    return response;
  } catch (error) {
    throw error;
  }
};

export const saveimportedEquipmentList = async (data) => {};
export const EditEquipmentlist = async (data) => {
  try {
    const response = await commonApi(
      "PUT",
      `${url}/api/edit-equipment-list`,
      data
    );
    return response;
  } catch (error) {
    throw error;
  }
};
export const deleteequipmentList = async (projectId,tagId) => {
  try {
    const response = await commonApi(
      "PUT",
      `${url}/api/delete-equipment-list`,{projectId,tagId}
    );
    return response;
  } catch (error) {
    throw error;
  }
};
//valveList

export const getvalvelist = async (id) => {
  try {
    const response = await commonApi("GET", `${url}/api/getvalve/${id}`);
    return response;
  } catch (error) {
    throw error;
  }
};
export const getValveDetails = async (id, tagId) => {
  try {
    const response = await commonApi(
      "GET",
      `${url}/api/getvalve-details/${id}/${tagId}`
    );
    return response;
  } catch (error) {
    throw error;
  }
};
export const saveimportedValveList = async (data) => {};
export const EditValvelist = async (data) => {
  try {
    const response = await commonApi("PUT", `${url}/api/edit-valve-list`, data);
    return response;
  } catch (error) {
    throw error;
  }
};
export const deletevalveList = async ( projectId, tag ) => {
  try {
    const response = await commonApi(
      "PUT",
      `${url}/api/delete-valve-list`, {projectId, tag }
    );
    return response;
  } catch (error) {
    throw error;
  }
};

// General tag info

export const fetchFromGentagInfo = async (id, tagId) => {
  try {
    const response = await commonApi(
      "GET",
      `${url}/api/getgeneral-taginfo-details/${id}/${tagId}`
    );
    return response;
  } catch (error) {
    throw error;
  }
};

export const fetchAllGentagInfo = async (id) => {
  try {
    const response = await commonApi(
      "GET",
      `${url}/api/get-allgeneral-taginfo/${id}`
    );
    console.log(response);

    return response;
  } catch (error) {
    throw error;
  }
};

export const fetchFromGentagInfoFields = async (id) => {
  try {
    const response = await commonApi(
      "GET",
      `${url}/api/getgeneral-taginfo-field/${id}`
    );
    return response;
  } catch (error) {
    throw error;
  }
};

export const UpdateGentagInfoFields = async (data) => {
  try {
    const response = await commonApi(
      "PUT",
      `${url}/api/update-general-taginfo-field`,
      data
    );
    return response;
  } catch (error) {
    throw error;
  }
};

export const EditGeneralTagInfolist = async (data) => {
  try {
    const response = await commonApi(
      "PUT",
      `${url}/api/edit-general-taginfo-list`,
      data
    );
    return response;
  } catch (error) {
    throw error;
  }
};


export const DeleteGeneralTagInfolist = async (data) => {
  try {
    const response = await commonApi(
      "PUT",
      `${url}/api/delete-general-taginfo-list`,
      data
    );
    return response;
  } catch (error) {
    throw error;
  }
};