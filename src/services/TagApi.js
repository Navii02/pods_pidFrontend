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

  }
  export const deletelineList = async(nuber)=>{

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

  }
  export const deleteequipmentList = async(nuber)=>{

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

  }
  export const deletevalveList = async(nuber)=>{

  }