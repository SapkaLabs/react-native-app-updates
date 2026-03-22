package com.appupdates.playstore

import android.app.Activity
import android.content.Intent
import android.content.IntentSender
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.InstallStatus

internal class RealPlayStoreBackend(
  private val reactApplicationContext: ReactApplicationContext
) : PlayStoreBackend {
  private val appUpdateManager: AppUpdateManager =
    AppUpdateManagerFactory.create(reactApplicationContext)

  private var pendingStartUpdatePromise: Promise? = null

  private val installStateUpdatedListener = InstallStateUpdatedListener { state ->
    if (state.installStatus() == InstallStatus.DOWNLOADED) {
      appUpdateManager.completeUpdate()
    }
  }

  init {
    appUpdateManager.registerListener(installStateUpdatedListener)
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

  override fun startPlayUpdate(
    flow: String,
    resumeInProgress: Boolean,
    promise: Promise
  ) {
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

    val activity = reactApplicationContext.currentActivity
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
          val launched =
            appUpdateManager.startUpdateFlowForResult(
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

  fun onActivityResult(
    requestCode: Int,
    resultCode: Int,
    data: Intent?
  ) {
    if (requestCode != PLAY_UPDATE_REQUEST_CODE) {
      return
    }

    val promise = pendingStartUpdatePromise ?: return
    pendingStartUpdatePromise = null

    when (resultCode) {
      Activity.RESULT_OK ->
        promise.resolve(createStartPlayUpdateResult("started", null, null))
      Activity.RESULT_CANCELED ->
        promise.resolve(createStartPlayUpdateResult("cancelled", null, null))
      else ->
        promise.resolve(
          createStartPlayUpdateResult(
            "failed",
            "activity_result_unexpected",
            "Play update flow finished with result code $resultCode."
          )
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
    appUpdateManager.unregisterListener(installStateUpdatedListener)
  }
}
