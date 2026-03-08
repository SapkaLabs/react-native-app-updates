package com.appupdates

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.IntentSender
import android.net.Uri
import android.os.Build
import androidx.core.content.pm.PackageInfoCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallException
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallErrorCode
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability

class AppUpdatesModule(reactContext: ReactApplicationContext) :
  NativeAppUpdatesSpec(reactContext) {

  private val appUpdateManager: AppUpdateManager = AppUpdateManagerFactory.create(reactContext)

  private var pendingStartUpdatePromise: Promise? = null

  private val installStateUpdatedListener = InstallStateUpdatedListener { state ->
    if (state.installStatus() == InstallStatus.DOWNLOADED) {
      appUpdateManager.completeUpdate()
    }
  }

  private val activityEventListener: ActivityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != PLAY_UPDATE_REQUEST_CODE) {
        return
      }

      val promise = pendingStartUpdatePromise ?: return
      pendingStartUpdatePromise = null

      when (resultCode) {
        Activity.RESULT_OK -> promise.resolve(createStartPlayUpdateResult("started", null, null))
        Activity.RESULT_CANCELED -> promise.resolve(createStartPlayUpdateResult("cancelled", null, null))
        else -> promise.resolve(
          createStartPlayUpdateResult(
            "failed",
            "activity_result_unexpected",
            "Play update flow finished with result code $resultCode."
          )
        )
      }
    }
  }

  init {
    reactContext.addActivityEventListener(activityEventListener)
    appUpdateManager.registerListener(installStateUpdatedListener)
  }

  override fun getInstalledAppInfo(promise: Promise) {
    try {
      val packageName = reactApplicationContext.packageName
      val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        reactApplicationContext.packageManager.getPackageInfo(
          packageName,
          android.content.pm.PackageManager.PackageInfoFlags.of(0L)
        )
      } else {
        @Suppress("DEPRECATION")
        reactApplicationContext.packageManager.getPackageInfo(packageName, 0)
      }

      val result = Arguments.createMap().apply {
        putString("identifier", packageInfo.packageName)
        putString("version", packageInfo.versionName ?: "")
        putString("buildNumber", PackageInfoCompat.getLongVersionCode(packageInfo).toString())
      }

      promise.resolve(result)
    } catch (exception: Exception) {
      promise.reject("get_installed_app_info_error", exception)
    }
  }

  override fun getPlayUpdateInfo(promise: Promise) {
    appUpdateManager.appUpdateInfo
      .addOnSuccessListener { appUpdateInfo ->
        promise.resolve(createPlayUpdateInfoResult(appUpdateInfo))
      }
      .addOnFailureListener { throwable ->
        promise.resolve(
          createPlayUpdateInfoFailure(
            errorCode = mapPlayErrorCode(throwable),
            message = throwable.message
          )
        )
      }
  }

  override fun startPlayUpdate(flow: String, resumeInProgress: Boolean, promise: Promise) {
    if (pendingStartUpdatePromise != null) {
      promise.resolve(
        createStartPlayUpdateResult(
          "failed",
          "update_already_in_progress",
          "A Play update flow is already running."
        )
      )
      return
    }

    val activity = reactApplicationContext.getCurrentActivity()
    if (activity == null) {
      promise.resolve(
        createStartPlayUpdateResult(
          "failed",
          "activity_unavailable",
          "A foreground activity is required to launch the Play update flow."
        )
      )
      return
    }

    appUpdateManager.appUpdateInfo
      .addOnSuccessListener { appUpdateInfo ->
        val updateType = resolveUpdateType(appUpdateInfo, flow, resumeInProgress)
        if (updateType == null) {
          promise.resolve(
            createStartPlayUpdateResult(
              "failed",
              "play_update_unavailable",
              "The requested Play update flow is not currently allowed."
            )
          )
          return@addOnSuccessListener
        }

        try {
          pendingStartUpdatePromise = promise
          val updateOptions = AppUpdateOptions.newBuilder(updateType).build()
          val launched = appUpdateManager.startUpdateFlowForResult(
            appUpdateInfo,
            activity,
            updateOptions,
            PLAY_UPDATE_REQUEST_CODE
          )

          if (!launched) {
            pendingStartUpdatePromise = null
            promise.resolve(
              createStartPlayUpdateResult(
                "failed",
                "launch_failed",
                "The Play update flow could not be launched."
              )
            )
          }
        } catch (exception: IntentSender.SendIntentException) {
          pendingStartUpdatePromise = null
          promise.resolve(
            createStartPlayUpdateResult(
              "failed",
              "send_intent_error",
              exception.message
            )
          )
        } catch (exception: Exception) {
          pendingStartUpdatePromise = null
          promise.resolve(
            createStartPlayUpdateResult(
              "failed",
              mapPlayErrorCode(exception),
              exception.message
            )
          )
        }
      }
      .addOnFailureListener { throwable ->
        promise.resolve(
          createStartPlayUpdateResult(
            "failed",
            mapPlayErrorCode(throwable),
            throwable.message
          )
        )
      }
  }

  override fun openUrl(url: String, promise: Promise) {
    try {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactApplicationContext.startActivity(intent)
      promise.resolve(createOpenUrlResult(true, null, null))
    } catch (exception: ActivityNotFoundException) {
      promise.resolve(
        createOpenUrlResult(
          false,
          "activity_not_found",
          exception.message ?: "No activity can handle the provided URL."
        )
      )
    } catch (exception: Exception) {
      promise.resolve(
        createOpenUrlResult(false, "open_url_failed", exception.message)
      )
    }
  }

  override fun invalidate() {
    pendingStartUpdatePromise?.resolve(
      createStartPlayUpdateResult(
        "failed",
        "native_module_invalidated",
        "The native module was invalidated before the Play update flow completed."
      )
    )
    pendingStartUpdatePromise = null
    reactApplicationContext.removeActivityEventListener(activityEventListener)
    appUpdateManager.unregisterListener(installStateUpdatedListener)
    super.invalidate()
  }

  private fun createPlayUpdateInfoFailure(errorCode: String, message: String?) = Arguments.createMap().apply {
    putString("status", "error")
    putBoolean("immediateAllowed", false)
    putBoolean("flexibleAllowed", false)
    putNull("availableVersionCode")
    putNull("clientVersionStalenessDays")
    putNull("updatePriority")
    putString("errorCode", errorCode)
    putString("message", message)
  }

  private fun createPlayUpdateInfoResult(appUpdateInfo: AppUpdateInfo) = Arguments.createMap().apply {
    putString("status", mapAvailabilityStatus(appUpdateInfo.updateAvailability()))
    putBoolean("immediateAllowed", isImmediateAllowed(appUpdateInfo))
    putBoolean("flexibleAllowed", isFlexibleAllowed(appUpdateInfo))
    putInt("availableVersionCode", appUpdateInfo.availableVersionCode())
    putNullableInt("clientVersionStalenessDays", appUpdateInfo.clientVersionStalenessDays())
    putInt("updatePriority", appUpdateInfo.updatePriority())
    putNull("errorCode")
    putNull("message")
  }

  private fun createStartPlayUpdateResult(
    outcome: String,
    errorCode: String?,
    message: String?
  ) = Arguments.createMap().apply {
    putString("outcome", outcome)
    putString("errorCode", errorCode)
    putString("message", message)
  }

  private fun createOpenUrlResult(opened: Boolean, errorCode: String?, message: String?) = Arguments.createMap().apply {
    putBoolean("opened", opened)
    putString("errorCode", errorCode)
    putString("message", message)
  }

  private fun isFlexibleAllowed(appUpdateInfo: AppUpdateInfo): Boolean {
    return appUpdateInfo.isUpdateTypeAllowed(AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build())
  }

  private fun isImmediateAllowed(appUpdateInfo: AppUpdateInfo): Boolean {
    return appUpdateInfo.isUpdateTypeAllowed(AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build())
  }

  private fun mapAvailabilityStatus(updateAvailability: Int): String {
    return when (updateAvailability) {
      UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS ->
        "developer_triggered_update_in_progress"
      UpdateAvailability.UPDATE_AVAILABLE -> "update_available"
      UpdateAvailability.UPDATE_NOT_AVAILABLE -> "update_not_available"
      else -> "error"
    }
  }

  private fun mapPlayErrorCode(throwable: Throwable?): String {
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

  private fun resolveUpdateType(
    appUpdateInfo: AppUpdateInfo,
    flow: String,
    resumeInProgress: Boolean
  ): Int? {
    if (
      resumeInProgress ||
        appUpdateInfo.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
    ) {
      return if (isImmediateAllowed(appUpdateInfo)) AppUpdateType.IMMEDIATE else null
    }

    if (appUpdateInfo.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE) {
      return null
    }

    return when (flow) {
      "flexible" -> if (isFlexibleAllowed(appUpdateInfo)) AppUpdateType.FLEXIBLE else null
      "immediate" -> if (isImmediateAllowed(appUpdateInfo)) AppUpdateType.IMMEDIATE else null
      else -> null
    }
  }

  private fun com.facebook.react.bridge.WritableMap.putNullableInt(key: String, value: Int?) {
    if (value == null) {
      putNull(key)
    } else {
      putInt(key, value)
    }
  }

  companion object {
    private const val PLAY_UPDATE_REQUEST_CODE = 34681
    const val NAME = NativeAppUpdatesSpec.NAME
  }
}



