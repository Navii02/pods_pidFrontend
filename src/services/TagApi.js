import { commonApi } from "./apiStructure";
import { url } from "./Url";

export const RegisterTag = async (formData) => {
  //console.log(formData);
  try {
    const response = await commonApi("POST", `${url}/api/addtag`, formData);
    console.log(response);

    return response;
  } catch (error) {
    throw error;
  }
};
export const GetTagDetails = async (id) => {
  try {
    const response = await commonApi("GET", `${url}/api/get-alltags/${id}`);
    //console.log(response);
    return response;
  } catch (error) {
    throw error;
  }
};

export const deleteTag = async (TagId) => {
  console.log(TagId);

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

export const updateTags = async(TagId,data)=>{
  try {
    const response = await commonApi('PUT',`${url}/api/update-tag/${TagId}`,data)
    return response
  } catch (error) {
    throw error
  }
}

export const AssignTag = async(tagId,uniqueIds,fileId)=>{
try {
    const data={tagId,uniqueIds,fileId}
  //console.log(tagId,uniqueIds,fileId);
  const response = await commonApi('POST',`${url}/api/assign-tag`,data)
  return response
} catch (error) {
 throw error 
}
  
}

 export const getAssignedTags = async(fileId)=>{
  //console.log(fileId);
  try {
     const response = await commonApi('GET',`${url}/api/get-assigned-tags/${fileId}`)
     return response
  } catch (error) {
    throw error
  }
  
 }


  export const getdocumentsbyTags= async(tagId)=>{
    try {
       const response = await commonApi('GET',`${url}/api/tags/${tagId}/documents`)
       return response
    } catch (error) {
      throw error
    }
  }


  //Linelist

  export const getLineList = async(id)=>{
  try {
    const response = await commonApi("GET", `${url}/api/getline/${id}`);
    //console.log(response);
    return response;
  } catch (error) {
    throw error;
  }
  }

  export const saveimportedLineList = async(data)=>{

  }
  export const EditLinelist = async(data)=>{
    try {
       const response = await commonApi('PUT',`${url}/api/edit-line-list`,data)
        return response
    } catch (error) {
      throw error
    }

  }
  export const deletelineList = async(tagId)=>{
 
    try {
       const response = await commonApi('DELETE',`${url}/api/delete-line-list/${tagId}`,)
        return response
    } catch (error) {
      throw error
    }
  }
  //EquipmentList

    export const getequipmentList = async(id)=>{
  try {
    const response = await commonApi("GET", `${url}/api/getequipment/${id}`);
    console.log(response);
    return response;
  } catch (error) {
    throw error;
  }
  }
   export const saveimportedEquipmentList = async(data)=>{

  }
 export const EditEquipmentlist = async(data)=>{
   try {
       const response = await commonApi('PUT',`${url}/api/edit-equipment-list`,data)
        return response
    } catch (error) {
      throw error
    }

  }
  export const deleteequipmentList = async(tagId)=>{
   
     
    try {
       const response = await commonApi('DELETE',`${url}/api/delete-equipment-list/${tagId}`,)
        return response
    } catch (error) {
      throw error
    }

  }
  //valveList 

      export const getvalvelist = async(id)=>{
  try {
    const response = await commonApi("GET", `${url}/api/getvalve/${id}`);
    console.log(response);
    return response;
  } catch (error) {
    throw error;
  }
  }
   export const saveimportedValveList = async(data)=>{


  }
 export const EditValvelist = async(data)=>{
 try {
       const response = await commonApi('PUT',`${url}/api/edit-valve-list`,data)
        return response
    } catch (error) {
      throw error
    }
  }
  export const deletevalveList = async(tagId)=>{
   
    try {
       const response = await commonApi('DELETE',`${url}/api/delete-valve-list/${tagId}`,)
        return response
    } catch (error) {
      throw error
    }

  }