import { commonApi } from "./apiStructure"
import { url } from "./Url"

   export const GetTagFiles = async(projectId)=>{
   try {
       const response = await commonApi('GET',`${url}/api/get-tag-files/${projectId}`,)
       return response
     } catch (error) {
      throw error
     }
   }
      export const getUnassignedmodelFiles = async(projectId)=>{
   try {
       const response = await commonApi('GET',`${url}/api/get-unassigned-modelfiles/${projectId}`,)
       return response
     } catch (error) {
      throw error
     }
   }