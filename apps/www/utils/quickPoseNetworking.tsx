import { ColorStyle, TDDocument, TDFile, TDShapeType, TldrawApp } from '@tldraw/tldraw'
import axios from 'axios'
import axiosRetry from 'axios-retry'
import * as BSON from 'bson'
import deepEqual from 'deep-equal'
import FormData from 'form-data'
import https from 'https'
import { MutableRefObject, useCallback } from 'react'
import React from 'react'
import { w3cwebsocket as W3CWebSocket } from 'websocket'
import { UsersIndicators } from '~../../packages/core/src/components/UsersIndicators'
import { quickPoseFile, studyConsentResponse } from './quickPoseTypes'
import { nodeRegex } from './quickposeDrawing'

export const LOCALHOST_BASE = 'http://127.0.0.1:8080'
export const ANALYTICS_URL = 'http://172.30.105.142:4000' // 'http://127.0.0.1:4000'
export const WEBSOCKET = 'ws://127.0.0.1:8080/thumbnail'
export function getIconImageURLNoTime(id: number) {
  return LOCALHOST_BASE + '/image/' + id //Add Time to avoid Caching so images update properly
}

export function getIconImageURL(id: number) {
  return LOCALHOST_BASE + '/image/' + id + '?' + new Date().getTime() //Add Time to avoid Caching so images update properly
}

export function connectWebSocket(
  thumbnailSocket: MutableRefObject<W3CWebSocket | null>,
  currentVersion: MutableRefObject<number | null>,
  rTldrawApp: MutableRefObject<TldrawApp>,
  connectInterval: MutableRefObject<any>,
  loadFile: MutableRefObject<quickPoseFile | null>,
  netData: MutableRefObject<any>,
  userID,
  setStudyPreferenceFromSettings,
  abortFileController: AbortController,
  resetState: { (app: TldrawApp): void }
) {
  //console.log(thumbnailSocket.current);
  if (
    thumbnailSocket.current === null ||
    thumbnailSocket.current === undefined ||
    thumbnailSocket.current.readyState !== thumbnailSocket.current.OPEN
  ) {
    thumbnailSocket.current = new W3CWebSocket(WEBSOCKET)
    const client: W3CWebSocket = thumbnailSocket.current
    client.onopen = () => {
      console.log('connected')
      clearTimeout(connectInterval.current)
      if (rTldrawApp !== undefined) {
        const app: TldrawApp = rTldrawApp.current!
        if (app !== undefined) {
          app.readOnly = false
          // loadFileFromProcessing(loadFile,abortFileController)
          // const tlNodes = app.getShapes().filter((shape) => nodeRegex.test(shape.id))
          // tlNodes.map(node => updateThumbnail(app,node.id,currentVersion))
        }
      }
      // if(client.readyState !== W3CWebSocket.CONNECTING){
      //   client.send("/tldrfile")
      // }
    }
    client.onmessage = (message) => {
      //console.log('socketmessage',message)

      const reader = new FileReader()
      reader.onload = async function () {
        const msgarray = new Uint8Array(this.result as ArrayBuffer)
        const msg = BSON.deserialize(msgarray)
        // console.log(msg)
        // console.log(msg.version_id)

        if (rTldrawApp !== undefined && currentVersion !== undefined) {
          const app: TldrawApp = rTldrawApp.current!
          const select = currentVersion.current!
          if (app !== undefined && select !== undefined) {
            for (const key in msg) {
              switch (key) {
                case 'project_name': {
                  if (app.appState.currentProject === '' && msg[key] !== '') {
                    resetState(app)
                    app.setCurrentProject(msg[key])
                  } else if (msg[key].toString() !== app.appState.currentProject) {
                    resetState(app)
                    app.setCurrentProject(msg[key])
                    console.log('new project')
                  }

                  // if (app.appState.currentProject !== msg[key]) {
                  //   app.setCurrentProject(msg[key])
                  // }

                  break
                }
                case 'version_id': {
                  //if(currentVersion.current === null){
                  currentVersion.current = parseInt(msg[key])
                  //}
                  break
                }
                case 'image': {
                  if (
                    msg.image.buffer.buffer.byteLength > 100 &&
                    select === parseInt(msg.version_id)
                  ) {
                    updateThumbnailFromSocket(
                      select,
                      app,
                      new Blob([msg.image.buffer], { type: 'image/png' })
                    )
                  }
                  break
                }
                case 'tldrfile': {
                  //console.log(JSON.parse(msg[key]))
                  //loadFile.current = JSON.parse(msg[key])
                  break
                }
                case 'versions': {
                  const data = JSON.parse(msg[key])
                  if (data !== undefined) {
                    netData.current = data
                  }
                  break
                }
                case 'userID': {
                  //console.log(msg[key].toString())
                  userID.current = msg[key].toString()
                  break
                }
                case 'Consent': {
                  //console.log('setfromsocket', msg[key])
                  switch (msg[key]) {
                    case 'EnabledNoPrompt': {
                      setStudyPreferenceFromSettings({ preference: 'Enabled', promptAgain: false })
                      break
                    }

                    case 'DisabledNoPrompt': {
                      setStudyPreferenceFromSettings({ preference: 'Disabled', promptAgain: false })
                      break
                    }
                    case 'Prompt': {
                      //setStudyPreferenceFromSettings({ preference: 'Prompt', promptAgain: true })
                      break
                    }
                    default: {
                      console.log('unknown consent', key, msg[key])
                      break
                    }
                  }
                  break
                }
                default: {
                  console.log('Unknown key', key, msg[key])
                  break
                }
              }
            }
          }
        }
      }
      reader.readAsArrayBuffer(message.data as unknown as Blob)
    }
    client.onclose = (e) => {
      if (rTldrawApp !== undefined) {
        const app: TldrawApp = rTldrawApp.current!
        if (app !== undefined) {
          console.log('close')
          app.readOnly = true
          app.setCurrentProject('')
          //resetState(app)
        }
      }
      connectInterval.current = setTimeout(() => {
        connectWebSocket(
          thumbnailSocket,
          currentVersion,
          rTldrawApp,
          connectInterval,
          loadFile,
          netData,
          userID,
          setStudyPreferenceFromSettings,
          abortFileController,
          resetState
        )
        console.log('trying to connect')
      }, 1000)
    }
  }
}

export const exportByColor = async (app: TldrawApp, color: ColorStyle) => {
  app.setIsLoading(true)
  const ids = app
    .getShapes()
    .filter((shape: { id: string }) => nodeRegex.test(shape.id))
    .filter((node: { style: { color: any } }) => node.style.color === color)
    .map((node: { id: string }) => {
      return node.id.replace(/\D/g, '')
    })
  //console.log(ids.toString())
  sendToLog('exportbycolor -- color:' + color + '| ids: ' + ids.toString())
  sendToUsageData('exportbycolor -- color:' + color + '| ids: ' + ids.toString())
  axios
    .post(
      LOCALHOST_BASE + '/exportbycolor',
      {},
      {
        params: {
          ids: ids.toString(),
          color: color.toString(),
        },
      }
    )
    .then(function (response) {
      //console.log(response);
    })
    .finally(() => {
      app.setIsLoading(false)
    })
    .catch(function (error) {
      console.log(error)
    })
}

export const saveToProcessing = async (
  document: TDDocument,
  simData: string,
  alpha: number,
  centerPoint: [number, number],
  projectName: string,
  studyConsent: string,
  projectID: MutableRefObject<string>,
  backup: boolean
) => {
  const file: quickPoseFile = {
    name: 'quickpose.tldr',
    fileHandle: null,
    document,
    assets: {
      ...document.assets,
    },
    graphData: {
      simData: simData,
      alpha: alpha.toString(),
      centerPoint: JSON.stringify(centerPoint),
      studyConsent: studyConsent,
      projectID: projectID.current,
    },
  }

  //console.log(result)
  // Serialize to JSON
  const json = JSON.stringify(file, null, 2)
  // Create blob
  const blob = new Blob([json], {
    type: 'application/vnd.Tldraw+json',
  })
  const formData = new FormData()
  formData.append('uploaded_file', blob, {
    //'uploaded_file' is a special name that the Processing side is looking for, don't change or itll break
    filename: 'quickpose.tldr',
    contentType: 'application/vnd.Tldraw+json',
  })

  const url = backup ? LOCALHOST_BASE + '/tldrfile_backup' : LOCALHOST_BASE + '/tldrfile'

  axios
    .post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Content-Disposition': 'filename=quickpose.tldr.png',
      },
      params: {
        ProjectName: projectName,
      },
      //signal: abortController.signal
    })
    .then(function (response) {
      //console.log(response);
    })
    .catch(function (error) {
      console.log(error)
    })

  return true
}
export const loadFileFromProcessing = async (
  loadFile: MutableRefObject<TDFile | undefined>,
  abortFileController: AbortController
) => {
  const getFile = await axios
    .get(LOCALHOST_BASE + '/tldrfile', {
      // signal: abortFileController.signal
    })
    .then(function (response) {
      const fileStatus = response.status
      const fileData = response.data
      if (fileStatus === 200 && fileData && loadFile.current === null) {
        //this third conditional is to avoid race conditions
        loadFile.current = fileData
        abortFileController.abort()
        //console.log("loaded file - aborting file requests")
      } else if (fileStatus === 201) {
        loadFile.current = undefined //this is the signal that we attempted to load a file, but it was missing
        //console.log("Found Session but no TLDR")
        abortFileController.abort()
      }
    })
    .catch(function (error) {
      //console.log(error);
    })
}

export const updateVersions = async (netData: any) => {
  //Update Versions
  axios
    .get(LOCALHOST_BASE + '/versions.json', {
      timeout: 500,
    })
    .then((response) => {
      if (response.data !== undefined) {
        netData.current = response.data
        //console.log(netData.current)
      }
    })
    .catch((error) => {
      //console.error("error fetching: ", error);
    })
}

const checkImage = (path: any) => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ img, status: 'ok' })
    img.onerror = () => resolve({ img, status: 'error' })
    img.src = path
  })
}

export const postStudyConsent = async (consentPreference: string, remind: string) => {
  axios
    .post(
      LOCALHOST_BASE + '/usageConsent',
      {},
      {
        params: {
          Consent: consentPreference,
          Remind: remind,
        },
      }
    )
    .then(function (response) {
      //console.log(response);
    })
    .finally(() => {})
    .catch(function (error) {
      console.log(error)
    })
}

export const sendUsageData = async (userID, projectID, graph, code) => {
  const httpsAgent = new https.Agent({
    cert: process.env.client_cert,
    key: process.env.client_key,
  })
  // const result = await axios.get('https://localhost:4000', { httpsAgent })
  // console.log(result)
  var usageLogs: string = ''
  await axios.get(LOCALHOST_BASE + '/usageData').then(function (response) {
    if (response.data !== undefined) {
      usageLogs = response.data
      // console.log(usageLogs)
    }
  })
  axios.post(
    ANALYTICS_URL + '/analytics',
    {
      userID: userID.current,
      projectID: projectID.current,
      logs: usageLogs,
    },
    {
      httpsAgent: httpsAgent,
    }
  )
  console.log('sending Usage Data', userID, projectID)
}

export const getStudyConsent = async (setStudyPreferenceFromSettings: {
  (pref: studyConsentResponse): void
}) => {
  axios
    .get(LOCALHOST_BASE + '/usageConsent')
    .then(function (response) {
      if (response.data !== undefined) {
        if (response.data === 'Prompt') {
          //setStudyPreferenceFromSettings({ preference: 'Prompt', promptAgain: true })
        } else if (response.data === 'EnabledNoPrompt') {
          setStudyPreferenceFromSettings({ preference: 'Enabled', promptAgain: false })
        } else if (response.data === 'DisabledNoPrompt') {
          setStudyPreferenceFromSettings({ preference: 'Disabled', promptAgain: false })
        }
      }
    })
    .finally(() => {})
    .catch(function (error) {
      console.log(error)
    })
}
export const updateThumbnail = async (
  app: TldrawApp,
  shape_id: string,
  currentVersion: MutableRefObject<number | null>
) => {
  const selectedShape = app.getShape(shape_id)
  if (!(selectedShape === undefined) && selectedShape.type == TDShapeType.VersionNode) {
    if (selectedShape.imgLink.startsWith('blob')) {
      URL.revokeObjectURL(selectedShape.imgLink)
    }
    const idInteger = parseInt(selectedShape.id.replace(/\D/g, ''))
    const url = getIconImageURL(idInteger)
    await checkImage(url)
      .then((res: any) => {
        if (res['status'] === 'ok') {
          selectedShape.imgLink = url
          const currentPageId = app.currentPageId
          const patch = {
            document: {
              pages: {
                [currentPageId]: {
                  shapes: {
                    [selectedShape.id]: {
                      imgLink: url,
                    },
                  },
                },
              },
            },
          }
          app.patchState(patch, 'Quickpose Image Update')
        } else if (res['status'] === 'error' && idInteger !== currentVersion.current) {
          console.log('image didnt load', shape_id, url)
          //setTimeout(()=>{updateThumbnail(app,shape_id,currentVersion)},5000)
        }
      })
      .catch((e) => {
        console.log('invalid image', e)
      })
  }
}

export const updateThumbnailFromSocket = async (
  selectedNode: number,
  app: TldrawApp,
  data: Blob
) => {
  const selectedShape = app.getShape(('node' + selectedNode).toString())
  if (!(selectedShape === undefined) && selectedShape.type == TDShapeType.VersionNode) {
    const idInteger = selectedShape.id.replace(/\D/g, '')
    const url = URL.createObjectURL(data)
    const currentPageId = app.currentPageId
    URL.revokeObjectURL(selectedShape.imgLink)
    const patch = {
      document: {
        pages: {
          [currentPageId]: {
            shapes: {
              [selectedShape.id]: {
                imgLink: url,
                hasLoaded: true,
              },
            },
          },
        },
      },
    }
    app.patchState(patch, 'Quickpose Thumbnail Update')
  }
}

export const updateSocketVersions = async (client: MutableRefObject<W3CWebSocket | null>) => {
  if (client.current) {
    client.current.send('/tldrfile')
  }
}

// export const updateCurrentVersion = async (currentVersion: MutableRefObject<number>) => {
//   axios.get(LOCALHOST_BASE+'/currentVersion', {
//       timeout: 500,
//     })
//     .then(response => {
//       if(response.data !== undefined){
//         currentVersion.current = parseInt(response.data)
//         return true
//       }else{
//         return false
//       }
//     })
//     .catch(error => {
//       //console.warn("error fetching current version: ", error);
//       return null
//     })
// }

export function useUploadAssets() {
  const onAssetUpload = useCallback(
    // Send the asset to our upload endpoint, which in turn will send it to AWS and
    // respond with the URL of the uploaded file.

    async (app: TldrawApp, file: File, id: string): Promise<string | false> => {
      const filename = encodeURIComponent(file.name)
      const url = LOCALHOST_BASE + '/assets/' + filename
      //console.log("making url",url)
      const client = axios.create()
      axiosRetry(client, {
        retries: 10,
        shouldResetTimeout: true,
        onRetry(retryCount, error, requestConfig) {
          console.log('retrying upload', retryCount)
        },
      })
      const formData = new FormData()
      formData.append('uploaded_file', file, file.name) //dont change 'uploaded_file' - processing side is looking for this label
      await client
        .put(url, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
        .catch(function (error) {
          console.error('error uploading image: ', error)
        })
      const res = await client.get(url)
      const status = await res.status
      if (status === 200) {
        return url
      } else {
        return false
      }
    },
    []
  )
  const onAssetDelete = useCallback(async (app: TldrawApp, id: string): Promise<boolean> => {
    const asset = app.assets.find((asset: { id: string }) => asset.id === id)
    await axios
      .delete(asset.src)
      .then((response) => {
        if (response.status == 200) {
          return true
        } else {
          return false
        }
      })
      .catch(function (error) {
        console.error('error deleting image: ', id, error)
        return false
      })
    return false
  }, [])
  return { onAssetUpload, onAssetDelete }
}

// export const getCurrentProject = async (currentProjectRef,rTldrawApp) => {
//   const currentProject = currentProjectRef!
//   const app = rTldrawApp!
//   //Update Thumbnail Image
//   if(currentProject !== undefined && app !== undefined && app.current !== undefined){
//     axios.get(LOCALHOST_BASE+'/projectName', {
//       timeout: 500,
//     })
//     .then(response => {
//       currentProject.current = response.data
//       app.current.appState.currentProject = response.data
//     })
//     .catch(error => {
//       //console.error("error fetching: ", error);
//       app.current.appState.currentProject = ''
//       // currentProject.current = ''
//     })
//   }
// }

export const sendToLog = async (message: string) => {
  axios
    .post(LOCALHOST_BASE + '/log', message, {})
    .then(function (response) {
      //console.log(response);
    })
    .catch(function (error) {
      console.log(error)
    })
}
export const sendToUsageData = async (message: string) => {
  axios
    .post(LOCALHOST_BASE + '/usageData', message, {})
    .then(function (response) {
      //console.log(response);
    })
    .catch(function (error) {
      console.log(error)
    })
}
