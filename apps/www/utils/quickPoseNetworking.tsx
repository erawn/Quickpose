/* eslint-disable @typescript-eslint/no-unused-vars */
import { ColorStyle, TDDocument, TDFile, TDShapeType, TldrawApp } from "@tldraw/tldraw";
import FormData from 'form-data'
import type { FileSystemHandle } from '@tldraw/tldraw'
import { w3cwebsocket as W3CWebSocket } from "websocket";
import axiosRetry from 'axios-retry';
import deepEqual from "deep-equal";
import { MutableRefObject, useCallback } from "react";
import axios from 'axios'
import { nodeRegex } from "./quickposeDrawing";
import { deserialize} from 'bson'
import { connect } from "http2";
import { m } from "@liveblocks/client/shared";
export const LOCALHOST_BASE = 'http://127.0.0.1:8080';
export const WEBSOCKET = 'ws://127.0.0.1:8080/thumbnail';
export function getIconImageURLNoTime(id:string){
    return LOCALHOST_BASE + "/image/" + id; //Add Time to avoid Caching so images update properly
}

export function getIconImageURL(id:string){
    return LOCALHOST_BASE + "/image/" + id + "?" + ((new Date()).getTime()); //Add Time to avoid Caching so images update properly
}

export function connectWebSocket(thumbnailSocket,selectedNode, rTldrawApp){
  let connectInterval;
  if(thumbnailSocket.current === null || 
    thumbnailSocket.current === undefined ||
    !thumbnailSocket.current.OPEN){
      thumbnailSocket.current = new W3CWebSocket(WEBSOCKET);
      const client:W3CWebSocket = thumbnailSocket.current
      client.onopen = () => {
        console.log('connected')
        clearTimeout(connectInterval);
      }
      client.onmessage = (message) => {
        //console.log('socketmessage',message)
       
          const reader = new FileReader()
          reader.onload = async function (){
            const msgarray = new Uint8Array(this.result as ArrayBuffer)
            const msg = deserialize(msgarray)
            //console.log(msg)
            //console.log(msg.image.buffer.buffer['ArrayBufferByteLength'])
            if(msg.image.buffer.buffer.byteLength > 100){
              updateThumbnail(selectedNode, rTldrawApp, new Blob([msg.image.buffer], { type: 'image/png' } ))
            }
        }
        reader.readAsArrayBuffer(message.data as unknown as Blob)
    
      }
      client.onclose = (e) => {
        connectInterval = setTimeout(function () {
          connectWebSocket(thumbnailSocket,selectedNode, rTldrawApp);
          console.log('trying to connect')
        }, 1000);
      }
    }
}

export const exportByColor = async(
  app: TldrawApp,
  color: ColorStyle
) => {
  app.setIsLoading(true)
  const ids = app.getShapes()
  .filter((shape) => nodeRegex.test(shape.id))
  .filter((node)=> node.style.color === color)
  .map((node)=>{
    return node.id.replace(/\D/g,"")
  })
  //console.log(ids.toString())
  sendToLog("exportbycolor -- color:"+color+"| ids: "+ids.toString())
  axios.post(LOCALHOST_BASE+'/exportbycolor', {}, {
    params: {
      ids: ids.toString(),
      color: color.toString()
    }
  })
  .then(function (response) {
    //console.log(response);
  }).finally(()=>{
    app.setIsLoading(false)
  })
  .catch(function (error) {
    console.log(error);
  });
}

export const saveToProcessing = async (
  document: TDDocument, 
  simData: string, alpha, 
  centerPoint: [number,number], 
  fileHandle: FileSystemHandle | null,
  abortController,
  projectName,
  backup:boolean) => {
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
    
    const url = backup ? LOCALHOST_BASE+'/tldrfile_backup' : LOCALHOST_BASE+'/tldrfile'

    axios.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        "Content-Disposition": "filename=quickpose.tldr.png",
      },
      params: {
        ProjectName: projectName
      }
      //signal: abortController.signal
    })
    .then(function (response) {
      //console.log(response);
    })
    .catch(function (error) {
      console.log(error);
    });
    
    return true
}
export const loadFileFromProcessing = async(loadFile: MutableRefObject<TDFile>,abortFileController: AbortController) => {

    const getFile = await axios.get(LOCALHOST_BASE+'/tldrfile', {
     // signal: abortFileController.signal
    }).then(function (response) {
      const fileStatus = response.status
      const fileData = response.data
      if(fileStatus === 200 && fileData && loadFile.current === null){ //this third conditional is to avoid race conditions
        loadFile.current = fileData
        abortFileController.abort()
        //console.log("loaded file - aborting file requests")
      }else if(fileStatus === 201){
        loadFile.current = undefined //this is the signal that we attempted to load a file, but it was missing
        //console.log("Found Session but no TLDR")
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
        newData.current = true;
        netData.current = response.data
      }
    })
    .catch(error => {
      //console.error("error fetching: ", error);
    })
  }

const checkImage = path => {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({img, status: 'ok'});
    img.onerror = () => resolve({img, status: 'error'});
    img.src = path;
  }); 
}
  
export const updateThumbnail = async (selectedNode, rTldrawApp, data) => {
    const rApp = rTldrawApp!
    let select = selectedNode!
    //console.log("thumbnail")
    //Update Thumbnail Image
    if(rApp !== undefined && select !== undefined){
      const app  : TldrawApp = rApp.current!
      select = select.current!
      //console.log("thumbnail2")
      if(app !== undefined && select !== undefined){
          const selectedShape = app.getShape(('node'+select).toString())
          if( !(selectedShape === undefined) && selectedShape.type == TDShapeType.VersionNode){
            const idInteger = selectedShape.id.replace(/\D/g,"")
            const url = URL.createObjectURL(data)
            const currentPageId = app.currentPageId
            URL.revokeObjectURL(selectedShape.imgLink) 
            const patch = {
              document: {
                pages: {
                  [currentPageId]: {
                    shapes: {
                      [selectedShape.id]: {
                        imgLink: url
                      },
                    },
                  },
                },
              },
            }
            app.patchState(patch, 'Quickpose Thumbnail Update')
        }
      }
    }
  }

  export const updateCurrentVersion = async (currentVersion, timeout,abortCurrentVersionController) => {
    axios.get(LOCALHOST_BASE+'/currentVersion', {
        timeout: 500,
      })
      .then(response => {
        if(response.data !== undefined){
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
    const currentProject = currentProjectRef!
    const app = rTldrawApp!
    //Update Thumbnail Image
    if(currentProject !== undefined && app !== undefined && app.current !== undefined){
      axios.get(LOCALHOST_BASE+'/projectName', {
        timeout: 500,
      })
      .then(response => {
        currentProject.current = response.data
        app.current.appState.currentProject = response.data
      })
      .catch(error => {
        //console.error("error fetching: ", error);
        app.current.appState.currentProject = ''
        // currentProject.current = ''
      })
    }
  }

  export const sendToLog = async(message: string) => {

    axios.post(LOCALHOST_BASE+'/log', message, {})
    .then(function (response) {
      //console.log(response);
    })
    .catch(function (error) {
      console.log(error);
    });
  }