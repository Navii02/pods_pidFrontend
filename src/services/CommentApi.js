import { commonApi } from "./apiStructure";
import { url } from "./Url";

export const getStatustableData = async (projectId) => {
  try {
    const response = await commonApi(
      "GET",
      `${url}/api/comment/get-comments/${projectId} `
    );
    return response;
  } catch (error) {
    throw error;
  }
};

 export const addStatus = async(statusData)=>{
    try {
       const response = await commonApi('POST',`${url}/api/comment/add-comment`,statusData) 
       return response 
    } catch (error) {
        throw error
    }

 }
  export const deleteStatus = async(statusId)=>{
    try {
         const response = await commonApi('DELETE',`${url}/api/comment/delete-comment/${statusId}`)
           return response
        
    } catch (error) {
        throw error
    }

  }
   export const GetStatusComment= async(id)=>{
    try {
      const response = await commonApi('GET',`${url}/api/getcomments/${id}`)
      return response
      
    } catch (error) {
      throw error
    }
   }
   export const SaveComment= async(data)=>{
    try {
      const response = await commonApi('POST',`${url}/api/savecomment`,data)
      return response
    } catch (error) {
      throw error
    }
   }

   export const getAllcomments = async(id)=>{
    try {
       const response = await commonApi('GET',`${url}/api/get-allcomments/${id}`)
       return response
      
    } catch (error) {
      throw error
    }
   }

   export const deleteComment = async(id)=>{
 console.log(id);
  try {
    const response = await commonApi('DELETE',`${url}/api/delete-comment/${id}`)
    return response
  } catch (error) {
    throw error
  }
   }
      export const deleteAllComment = async(id)=>{
 console.log(id);
  try {
    const response = await commonApi('DELETE',`${url}/api/delete=all-comments/${id}`)
    return response
  } catch (error) {
    throw error
  }
   }
    export const updateComment= async(data)=>{
 console.log(data);
  try {
    const response = await commonApi('PUT',`${url}/api/update-comment`,data)
    return response
  } catch (error) {
    throw error
  }
 
    }
     export const getcomments = async(id)=>{
    try {
       const response = await commonApi('GET',`${url}/api/get-comments/${id}`)
       return response
      
    } catch (error) {
      throw error
    }
   }