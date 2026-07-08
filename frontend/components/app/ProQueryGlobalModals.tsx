import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useNavigationContainerRef } from '@react-navigation/native';

import ProQueryCompleteModal from './ProQueryCompleteModal';

import {

  initProQueryJobTracker,

  subscribeProQueryJobComplete,

  teardownProQueryJobTracker,

  type ProQueryJobCompletePayload,

} from '../../services/proQueryJobTracker';

import { navigateAfterProQuery } from '../../src/utils/proQueryNavigation';

import { openPortalDetailFromProQueryNotification } from '../../src/utils/notificationNavigation';



type Props = {

  navigationRef: ReturnType<typeof useNavigationContainerRef>;

  navReady: boolean;

};



export default function ProQueryGlobalModals({ navigationRef, navReady }: Props) {

  const [completeVisible, setCompleteVisible] = useState(false);

  const [completePayload, setCompletePayload] = useState<ProQueryJobCompletePayload | null>(null);

  const completePayloadRef = useRef<ProQueryJobCompletePayload | null>(null);



  const openCompleteModal = useCallback((payload: ProQueryJobCompletePayload) => {

    completePayloadRef.current = payload;

    setCompletePayload(payload);

    setCompleteVisible(true);

  }, []);



  useEffect(() => {

    initProQueryJobTracker();

    const unsub = subscribeProQueryJobComplete(openCompleteModal);

    return () => {

      unsub();

      teardownProQueryJobTracker();

    };

  }, [openCompleteModal]);



  const handleOpenDetail = useCallback(async () => {

    const payload = completePayloadRef.current ?? completePayload;

    setCompleteVisible(false);

    if (!payload) return;



    const opened = await openPortalDetailFromProQueryNotification(navigationRef, payload);

    if (opened) return;



    const nav = navigationRef;

    if (payload.result && typeof nav?.navigate === 'function') {

      await navigateAfterProQuery(

        {

          push: (pathname: string, params?: Record<string, string>) => {

            if (typeof nav.push === 'function') {

              nav.push(pathname as never, params as never);

              return;

            }

            nav.navigate(pathname as never, params as never);

          },

        },

        payload.result,

      );

    }

  }, [completePayload, navigationRef]);



  if (!navReady) return null;



  return (

    <ProQueryCompleteModal

      visible={completeVisible}

      onOpenDetail={() => {

        void handleOpenDetail();

      }}

      onDismiss={() => setCompleteVisible(false)}

    />

  );

}



/** Push / in-app bildirimden tamamlanma modalı açmak için. */

export function showProQueryCompleteModalFromNotification(

  listener: (payload: ProQueryJobCompletePayload) => void,

  data: {

    dfa_snapshot_id?: number | string;

    snapshotId?: number | string;

    job_id?: string;

    deep_link?: string;

    deepLink?: string;

  },

): void {

  const raw = data.dfa_snapshot_id ?? data.snapshotId;

  const snapshotId = Number(raw);

  listener({

    jobId: String(data.job_id || ''),

    snapshotId: Number.isFinite(snapshotId) && snapshotId > 0 ? snapshotId : null,

    deepLink: String(data.deep_link ?? data.deepLink ?? '').trim() || undefined,

    result: null,

  });

}


