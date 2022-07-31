import * as React from 'react'
// import type { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import dynamic from 'next/dynamic'
import { Utils } from '@tldraw/core'

const IFrameWarning = dynamic(() => import('components/IFrameWarning'), {
  ssr: false,
}) as any

// const ReadOnlyMultiplayerEditor = dynamic(() => import('components/ReadOnlyMultiplayerEditor'), {
//   ssr: false,
// }) as any

interface RoomProps {
  id: string
}

export default function Room({ id }: RoomProps) {
  if (typeof window !== 'undefined' && window.self !== window.top) {
    return <IFrameWarning url={`https://tldraw.com/v/${id}`} />
  }

  // return <ReadOnlyMultiplayerEditor isUser={isUser} isSponsor={isSponsor} roomId={id} />
}

// export const getServerSideProps: GetServerSideProps = async (context) => {
//   const session = await getSession(context)
//   const id = context.query.id?.toString()

//   return {
//     props: {
//       id: Utils.lns(id),
//       isUser: session?.user ? true : false,
//       isSponsor: session?.isSponsor ?? false,
//     },
//   }
// }
