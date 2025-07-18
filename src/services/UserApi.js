import { commonApi } from "./apiStructure"
import { url } from "./Url"

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