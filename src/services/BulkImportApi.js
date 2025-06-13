import { commonApi } from "./apiStructure";
import { url } from "./Url";


 export const uploadFiles = async(file,headers,onUploadProgress)=>{
 console.log(file);
 try {
    const response = await commonApi(`POST`,`${url}/api/upload-bulk-files`,file,{headers,onUploadProgress,})
    console.log(response.data);
    
     return response
 } catch (error) {
    throw error
 }

 
 }
 
 export const saveUnassignedData = async(file)=>{
console.log(file);
 try {
   const response = await commonApi('POST',`${url}/api/save-bulkimport`,file)
    return response
 } catch (error) {
   throw error
 }

 }
 export const saveChangedUnassigned = async(files)=>{
   try {
      const response = await commonApi('POST',`${url}/api/save-changedfiles`,files)
       return response
   } catch (error) {
      throw error
   }
 }

