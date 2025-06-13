import { commonApi } from "./apiStructure";
import { url } from "./Url";

// Function to fetch SVG files from the API
export const fetchSvgFiles = async (data) => {
  try {
    const res = await commonApi(
      "GET",
      `${url}/api/getsvgdocuments`,
      null,
      null,
      data
    );
    //console.log('fetchSvgFiles response:', res);
    return res;
  } catch (err) {
    console.error("Error fetching SVG list:", err);
    throw err;
  }
};

export const GetSpidDocument = async (fileId) => {
  try {
    const res = await commonApi(
      "GET",
      `${url}/api/getspiddocument/${fileId}`,
      null,
      {
        Accept: "image/svg+xml",
        responseType: "blob",
      }
    );

    if (!(res instanceof Blob)) {
      const error = new Error("Expected a blob response");
      error.response = res;
      throw error;
    }

    return res;
  } catch (error) {
    console.error("Error fetching SVG for fileId:", fileId, error);
    throw error;
  }
};

export const getSpidElements = async (fileId) => {
  try {
    const response = await commonApi(
      "GET",
      `${url}/api/spidelements/${fileId}`
    );
    // console.log('getSpidElements response:', response);
    return response;
  } catch (error) {
    console.error("Error fetching spid elements:", error);
    throw error;
  }
};

export const saveElementswithUniqueId = async (items, fileId) => {
  try {
    // console.log('Saving items:', { items: items, fileId: fileId });

    const response = await commonApi(
      "POST",
      `${url}/api/saveelementswithuniqueId/${fileId}`,
      { items },
      {
        "Content-Type": "application/json",
      }
    );

    //console.log('saveElementswithUniqueId response:', response);
    return response;
  } catch (error) {
    console.error("Error saving elements:", {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw error;
  }
};

export const UpdateSpidData = async (fileId, svgContent, items, viewState) => {
  try {
    const response = await commonApi(
      "POST",
      `${url}/api/updatespiddata/${fileId}`,
      { svgContent, items, viewState }
    );
    return response;
  } catch (error) {
    throw error;
  }
};

//Flag 


export const SaveassignedFlag = async(data)=>{
  try {
    const response = await commonApi('POST',`${url}/api/assign-flag`,data)
    return response
    
  } catch (error) {
    throw error
  }
}


 export const getAssignedFlags = async(fileId)=>{
  console.log(fileId);
  
  try {
    const response = await commonApi('GET',`${url}/api/get-assigned-flags/${fileId}`)
    return response
  } catch (error) {
    throw error
  }
 }