package com.appupdates.playstore

import android.content.IntentSender
import com.facebook.react.bridge.ReadableArray
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallException
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallErrorCode
import com.google.android.play.core.install.model.UpdateAvailability

internal val DEFAULT_ALLOWED_UPDATE_TYPES = listOf("flexible", "immediate")
internal const val PLAY_UPDATE_REQUEST_CODE = 34681

internal fun isFlexibleAllowed(appUpdateInfo: AppUpdateInfo): Boolean {
  return appUpdateInfo.isUpdateTypeAllowed(
    AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build()
  )
}

internal fun isImmediateAllowed(appUpdateInfo: AppUpdateInfo): Boolean {
  return appUpdateInfo.isUpdateTypeAllowed(
    AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build()
  )
}

internal fun mapAvailabilityStatus(updateAvailability: Int): String {
  return when (updateAvailability) {
    UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS ->
      "developer_triggered_update_in_progress"
    UpdateAvailability.UPDATE_AVAILABLE -> "update_available"
    UpdateAvailability.UPDATE_NOT_AVAILABLE -> "update_not_available"
    else -> "error"
  }
}

internal fun mapFakeStateAvailability(appUpdateInfo: AppUpdateInfo): String {
  return when (appUpdateInfo.updateAvailability()) {
    UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS -> "inProgress"
    UpdateAvailability.UPDATE_AVAILABLE -> "available"
    else -> "notAvailable"
  }
}

internal fun mapInstallErrorCode(errorCode: String): Int? {
  return when (errorCode) {
    "app_not_owned" -> InstallErrorCode.ERROR_APP_NOT_OWNED
    "app_update_api_not_available" -> InstallErrorCode.ERROR_API_NOT_AVAILABLE
    "download_not_present" -> InstallErrorCode.ERROR_DOWNLOAD_NOT_PRESENT
    "install_not_allowed" -> InstallErrorCode.ERROR_INSTALL_NOT_ALLOWED
    "internal_error" -> InstallErrorCode.ERROR_INTERNAL_ERROR
    "play_store_not_found" -> InstallErrorCode.ERROR_PLAY_STORE_NOT_FOUND
    "unknown_error" -> InstallErrorCode.ERROR_UNKNOWN
    else -> null
  }
}

internal fun mapPlayErrorCode(throwable: Throwable?): String {
  if (throwable is InstallException) {
    return when (throwable.errorCode) {
      InstallErrorCode.ERROR_API_NOT_AVAILABLE -> "app_update_api_not_available"
      InstallErrorCode.ERROR_APP_NOT_OWNED -> "app_not_owned"
      InstallErrorCode.ERROR_DOWNLOAD_NOT_PRESENT -> "download_not_present"
      InstallErrorCode.ERROR_INSTALL_NOT_ALLOWED -> "install_not_allowed"
      InstallErrorCode.ERROR_INTERNAL_ERROR -> "internal_error"
      InstallErrorCode.ERROR_PLAY_STORE_NOT_FOUND -> "play_store_not_found"
      InstallErrorCode.ERROR_UNKNOWN -> "unknown_error"
      else -> "unknown_error"
    }
  }

  return when (throwable) {
    is IntentSender.SendIntentException -> "send_intent_error"
    else -> "unknown_error"
  }
}

internal fun normalizeAllowedUpdateTypes(
  allowedUpdateTypes: ReadableArray?
): List<String> {
  if (allowedUpdateTypes == null || allowedUpdateTypes.size() == 0) {
    return DEFAULT_ALLOWED_UPDATE_TYPES
  }

  val normalized = mutableListOf<String>()
  for (index in 0 until allowedUpdateTypes.size()) {
    val value = allowedUpdateTypes.getString(index) ?: continue
    if (
      (value == "flexible" || value == "immediate") &&
        !normalized.contains(value)
    ) {
      normalized.add(value)
    }
  }

  return if (normalized.isEmpty()) {
    DEFAULT_ALLOWED_UPDATE_TYPES
  } else {
    normalized
  }
}

internal fun resolveUpdateType(
  appUpdateInfo: AppUpdateInfo,
  flow: String,
  resumeInProgress: Boolean
): Int? {
  if (
    resumeInProgress ||
      appUpdateInfo.updateAvailability() ==
        UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
  ) {
    return if (isImmediateAllowed(appUpdateInfo)) {
      AppUpdateType.IMMEDIATE
    } else {
      null
    }
  }

  if (appUpdateInfo.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE) {
    return null
  }

  return when (flow) {
    "flexible" ->
      if (isFlexibleAllowed(appUpdateInfo)) {
        AppUpdateType.FLEXIBLE
      } else {
        null
      }
    "immediate" ->
      if (isImmediateAllowed(appUpdateInfo)) {
        AppUpdateType.IMMEDIATE
      } else {
        null
      }
    else -> null
  }
}
