import { commonApi } from "./apiStructure";
import { url } from "./Url";

export const GetAllUnAssignedPath= async()=>{

}

export const getAllTagsDetails= async()=>{
    
}
export const getAllTags= async()=>{
    
}

export const GetAllmodals= async(projectId,ids)=>{
   console.log(projectId,ids);
    try {
        const response = await commonApi('GET',`${url}/api/getmodel/${projectId}/${ids}`)
         return response
    } catch (error) {
        throw error
    }
   
}