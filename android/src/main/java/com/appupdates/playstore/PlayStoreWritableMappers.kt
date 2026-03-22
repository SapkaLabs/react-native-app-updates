package com.appupdates.playstore

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.testing.FakeAppUpdateManager

internal fun createAllowedUpdateTypesArray(
  allowedUpdateTypes: List<String>
): WritableArray {
  return Arguments.createArray().apply {
    allowedUpdateTypes.forEach(::pushString)
  }
}

internal fun createFakePlayStoreStateResult(
  snapshot: FakePlayStoreSnapshot,
  fakeAppUpdateManager: FakeAppUpdateManager
): WritableMap {
  return Arguments.createMap().apply {
    putArray(
      "allowedUpdateTypes",
      createAllowedUpdateTypesArray(snapshot.allowedUpdateTypes)
    )
    putString("availability", snapshot.availability)
    putNullableInt("availableVersionCode", snapshot.availableVersionCode)
    putDouble("bytesDownloaded", snapshot.bytesDownloaded.toDouble())
    putNullableInt(
      "clientVersionStalenessDays",
      snapshot.clientVersionStalenessDays
    )
    putString("installErrorCode", snapshot.installErrorCode)
    putBoolean(
      "isConfirmationDialogVisible",
      fakeAppUpdateManager.isConfirmationDialogVisible
    )
    putBoolean(
      "isImmediateFlowVisible",
      fakeAppUpdateManager.isImmediateFlowVisible
    )
    putBoolean(
      "isInstallSplashScreenVisible",
      fakeAppUpdateManager.isInstallSplashScreenVisible
    )
    putDouble("totalBytesToDownload", snapshot.totalBytesToDownload.toDouble())
    putNullableInt("updatePriority", snapshot.updatePriority)
  }
}

internal fun createPlayUpdateInfoFailure(
  errorCode: String,
  message: String?
): WritableMap {
  return Arguments.createMap().apply {
    putString("status", "error")
    putBoolean("immediateAllowed", false)
    putBoolean("flexibleAllowed", false)
    putNull("availableVersionCode")
    putNull("clientVersionStalenessDays")
    putNull("updatePriority")
    putString("errorCode", errorCode)
    putString("message", message)
  }
}

internal fun createPlayUpdateInfoResult(
  appUpdateInfo: AppUpdateInfo
): WritableMap {
  return Arguments.createMap().apply {
    putString("status", mapAvailabilityStatus(appUpdateInfo.updateAvailability()))
    putBoolean("immediateAllowed", isImmediateAllowed(appUpdateInfo))
    putBoolean("flexibleAllowed", isFlexibleAllowed(appUpdateInfo))
    putInt("availableVersionCode", appUpdateInfo.availableVersionCode())
    putNullableInt(
      "clientVersionStalenessDays",
      appUpdateInfo.clientVersionStalenessDays()
    )
    putInt("updatePriority", appUpdateInfo.updatePriority())
    putNull("errorCode")
    putNull("message")
  }
}

internal fun createStartPlayUpdateResult(
  outcome: String,
  errorCode: String?,
  message: String?
): WritableMap {
  return Arguments.createMap().apply {
    putString("outcome", outcome)
    putString("errorCode", errorCode)
    putString("message", message)
  }
}

internal fun WritableMap.putNullableInt(key: String, value: Int?) {
  if (value == null) {
    putNull(key)
  } else {
    putInt(key, value)
  }
}
