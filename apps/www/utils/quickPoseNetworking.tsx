import { TDDocument, TDFile, TDShapeType, TldrawApp } from "@tldraw/tldraw";
import FormData from 'form-data'
import type { FileSystemHandle } from '@tldraw/tldraw'

import axiosRetry from 'axios-retry';
import deepEqual from "deep-equal";
import { useCallback } from "react";
import axios from 'axios'
export const LOCALHOST_BASE = 'http://127.0.0.1:8080';



export function getIconImageURLNoTime(id:string){
    return LOCALHOST_BASE + "/image/" + id; //Add Time to avoid Caching so images update properly
}

export function getIconImageURL(id:string){
    return LOCALHOST_BASE + "/image/" + id + "?" + ((new Date()).getTime()); //Add Time to avoid Caching so images update properly
}

export const saveToProcessing = async (document: TDDocument, simData: string, alpha, centerPoint: [number,number], fileHandle: FileSystemHandle | null,abortController) => {
    const file: TDFile = {
        name: 'quickpose.tldr',
        fileHandle: fileHandle ?? null,
        document,
        assets: {"simData":simData,
                "alpha":alpha.toString(),
                "centerPoint": JSON.stringify(centerPoint),
                ...document.assets
                },
      }
    // Serialize to JSON
    const json = JSON.stringify(file, null, 2)
    // Create blob
    const blob = new Blob([json], {
      type: 'application/vnd.Tldraw+json',
    })
    const formData = new FormData()
    formData.append('uploaded_file', blob, { //'uploaded_file' is a special name that the Processing side is looking for, don't change or itll break
      filename: 'quickpose.tldr',
      contentType: 'application/vnd.Tldraw+json'
    })

    axios.post(LOCALHOST_BASE+'/tldrfile', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        "Content-Disposition": "filename=quickpose.tldr.png"
      },
      signal: abortController.signal
    })
    .then(function (response) {
      //console.log(response);
    })
    .catch(function (error) {
      //console.log(error);
    });
    
    return true
}
export const loadFileFromProcessing = async(loadFile,abortFileController) => {

    const getFile = await axios.get(LOCALHOST_BASE+'/tldrfile', {
     // signal: abortFileController.signal
    }).then(function (response) {
      const fileStatus = response.status
      const fileData = response.data
      if(fileStatus === 200 && fileData && loadFile.current === null){ //this third conditional is to avoid race conditions
        loadFile.current = fileData
        abortFileController.abort()
        console.log("loaded file - aborting file requests")
      }else if(fileStatus === 201){
        loadFile.current = undefined //this is the signal that we attempted to load a file, but it was missing
        console.log("Found Session but no TLDR")
        abortFileController.abort()
    } 
    })
    .catch(function (error) {
      //console.log(error);
    });
  }

export const updateVersions = async (netData, newData, abortVersionsController:AbortController) => {
    //Update Versions
    
    axios.get(LOCALHOST_BASE+'/versions.json', {
      timeout: 500,
    })
    .then(response => {
      
      if(response.data !== undefined){
        //console.log(response.data)
        newData.current = true;
        netData.current = response.data
        // .nodes = parsedData["Nodes"]
        // netData.current.links = parsedData["Edges"]
        //dataInterval()
      }else{
        //console.log("samedata",response.data)
      }
    })
    .catch(error => {
      //console.error("error fetching: ", error);
    })
  }
export const updateThumbnail = async (selectedNode, rTldrawApp) => {
    let app = rTldrawApp!
    let select = selectedNode!
    //Update Thumbnail Image
    if(app !== undefined && select !== undefined){
      app = app.current!
      select = select.current!
      if(app !== undefined && select !== undefined){
          const selectedShape = app.getShape(('node'+select).toString())
          if( !(selectedShape === undefined) && selectedShape.type == TDShapeType.VersionNode){
            const idInteger = selectedShape.id.replace(/\D/g,"")
            const res = await axios.get(getIconImageURL(idInteger),{timeout:500})
            const status = await res.status
            if(status === 200){
              selectedShape.imgLink = getIconImageURL(idInteger)//refresh the thumbnail image
              app.updateShapes(selectedShape)
            }else{
              return false
            }
           
            //console.log("update thumbnail")
          }
      }
    }
  }

  export const updateCurrentVersion = async (currentVersion, timeout,abortCurrentVersionController) => {
    // const client = axios.create()
    //     axiosRetry(client, { 
    //       retries: 1,
    //       shouldResetTimeout: false,
    //       onRetry(retryCount, error, requestConfig) {
    //           //console.log("retrying update",retryCount)
    //       },
    //      });
    //console.log("currentVersion is  "+ currentVersion.current)
    axios.get(LOCALHOST_BASE+'/currentVersion', {
        timeout: 500,
      })
      .then(response => {
        //console.log(response)
        if(response.data !== undefined){
          //console.log("currentVersion is  "+ currentVersion.current)
          currentVersion.current = response.data.toString()
          return true
          
        }else{
          return false
        }
      })
      .catch(error => {
        //console.warn("error fetching current version: ", error);
        return null
      })
  }

  export function useUploadAssets() {
    const onAssetUpload = useCallback(
      // Send the asset to our upload endpoint, which in turn will send it to AWS and
      // respond with the URL of the uploaded file.
      
      async (app: TldrawApp, file: File, id: string): Promise<string | false> => {
        const filename = encodeURIComponent(file.name)
        const url = LOCALHOST_BASE+"/assets/"+filename
        //console.log("making url",url)
        const client = axios.create()
        axiosRetry(client, { 
          retries: 10,
          shouldResetTimeout: true,
          onRetry(retryCount, error, requestConfig) {
              console.log("retrying upload",retryCount)
          },
         });
        const formData = new FormData()
        formData.append('uploaded_file', file, file.name)//dont change 'uploaded_file' - processing side is looking for this label
        await client.put(url, formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          })
          .catch(function (error) {
            console.error("error uploading image: ", error);
          });
        const res = await client.get(url)
        const status = await res.status
        if(status === 200){
          return url
        }else{
          return false
        }
      },
      []
    )
    const onAssetDelete = useCallback(
      // Send the asset to our upload endpoint, which in turn will send it to AWS and
      // respond with the URL of the uploaded file.
  
      async (app: TldrawApp, id: string): Promise<boolean>=> {
        const asset = app.assets.find(asset => asset.id === id)
        await axios.delete(asset.src).then(response =>{
          if(response.status == 200){
            return true
          }
        }).catch(function(error){ 
          console.error("error deleting image: ",id, error);
          return false
        })
        return false
      },
      []
    )
  
    return { onAssetUpload, onAssetDelete }
  }


  export const getCurrentProject = async (currentProjectRef,rTldrawApp) => {
    //Update Versions
    let app:TldrawApp = rTldrawApp!
    const currentProject = currentProjectRef!
    //Update Thumbnail Image
    if(app !== undefined && currentProject !== undefined){
      app = rTldrawApp.current!
      const current = currentProject.current
      if(app !== undefined && current !== undefined){
    
        axios.get(LOCALHOST_BASE+'/projectName', {
          timeout: 500,
        })
        .then(response => {
          currentProject.current = response.data
          app.appState.currentProject = response.data
        })
        .catch(error => {
          //console.error("error fetching: ", error);
          app.appState.currentProject = ''
          currentProject.current = ''
        })
      }
    }
  }