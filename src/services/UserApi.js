import { commonApi } from "./apiStructure"
import { url } from "./Url"

export const GetuserDetails = async(data)=>{
    console.log(data);
    
    try {
        const response = await commonApi(`POST`,`${url}/api/user-login`,data)
        console.log(response)
        return response
    } catch (error) {
        throw error
    }
}



 export const AssignuserFeature = async(data)=>{
    try {
        const response = await commonApi('POST',`${url}/api/admin/assign-feature`,data)
        return response
    } catch (error) {
        throw error
    }
 }

 export const getfeatures = async()=>{
    try {
        const response = await commonApi('GET',`${url}/api/admin/get-features`)
        return response
    } catch (error) {
        throw error
    }
 }
 
 export const getUserfeature = async()=>{
    try {
        const response = await commonApi('GET',`${url}/api/admin/get-user-features`)
        console.log(response.data);
        
        return response
    } catch (error) {
        throw error
    }
 }


  export const Adduser = async(data)=>{
    try {
        const response = await commonApi(`POST`,`${url}/api/superadmin/add-user`,data)
        return response
    } catch (error) {
        throw error
    }
  }

  export const GetAllUsers = async()=>{
    try {
        const response = await commonApi('GET',`${url}/api/superadmin/get-user`)
        console.log( response.data);
        
        return response
    } catch (error) {
        throw error
    }
  }
  
  export const SaveProjectAdmin = async(assignments)=>{
    try {
        const response = await commonApi(`POST`,`${url}/api/superadmin/assign-projectadmin`,assignments)
        return response
    } catch (error) {
        throw error
    }
  }
   export const getUserAssignedFeatures= async()=>{
    try {
         const response = await commonApi(`GET`,`${url}/Api/superadmin/get-assigned-users`)
         return response
    } catch (error) {
        throw error
    }
   } 
  
  