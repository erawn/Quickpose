import * as React from 'react'

import { getSession } from 'next-auth/react'
import dynamic from 'next/dynamic'
const MultiplayerEditor = dynamic(() => import('components/MultiplayerEditor'), {
  ssr: false,
}) as any

interface RoomProps {
  id: string
  isSponsor: boolean
  isUser: boolean
}

export default function Room({ id, isUser, isSponsor }: RoomProps) {
  return <MultiplayerEditor isUser={isUser} isSponsor={isSponsor} roomId={id} />
}
