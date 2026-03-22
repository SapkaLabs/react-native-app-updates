package com.appupdates.playstore

import android.content.IntentSender
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.appupdate.testing.FakeAppUpdateManager
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus

internal class FakePlayStoreBackend(
  private val reactApplicationContext: ReactApplicationContext
) : PlayStoreBackend {
  private var fakeAppUpdateManager: FakeAppUpdateManager =
    createFakeAppUpdateManager()

  private var fakePlayStoreSnapshot = FakePlayStoreSnapshot()

  private val installStateUpdatedListener = InstallStateUpdatedListener { state ->
    if (state.installStatus() == InstallStatus.DOWNLOADED) {
      val totalBytes = fakePlayStoreSnapshot.totalBytesToDownload
      fakePlayStoreSnapshot = fakePlayStoreSnapshot.copy(
        bytesDownloaded = if (totalBytes > 0L) totalBytes else 0L
      )
      fakeAppUpdateManager.completeUpdate()
    }
  }

  init {
    fakeAppUpdateManager.registerListener(installStateUpdatedListener)
  }

  override fun getPlayUpdateInfo(promise: Promise) {
    fakeAppUpdateManager.appUpdateInfo
      .addOnSuccessListener { appUpdateInfo ->
        fakePlayStoreSnapshot = fakePlayStoreSnapshot.copy(
          availability = mapFakeStateAvailability(appUpdateInfo)
        )
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

    fakeAppUpdateManager.appUpdateInfo
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
          val updateOptions = AppUpdateOptions.newBuilder(updateType).build()
          val launched =
            fakeAppUpdateManager.startUpdateFlowForResult(
              appUpdateInfo,
              activity,
              updateOptions,
              PLAY_UPDATE_REQUEST_CODE
            )

          if (!launched) {
            promise.resolve(
              createStartPlayUpdateResult(
                "failed",
                "launch_failed",
                "The Play update flow could not be launched."
              )
            )
            return@addOnSuccessListener
          }

          resolveFakePlayStoreState { fakeState ->
            fakePlayStoreSnapshot = fakeState
            promise.resolve(createStartPlayUpdateResult("started", null, null))
          }
        } catch (exception: IntentSender.SendIntentException) {
          promise.resolve(
            createStartPlayUpdateResult(
              "failed",
              "send_intent_error",
              exception.message
            )
          )
        } catch (exception: Exception) {
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

  fun getFakePlayStoreState(promise: Promise) {
    resolveFakePlayStoreState { fakeState ->
      fakePlayStoreSnapshot = fakeState
      promise.resolve(
        createFakePlayStoreStateResult(fakePlayStoreSnapshot, fakeAppUpdateManager)
      )
    }
  }

  fun resetFakePlayStore(promise: Promise) {
    resetFakePlayStoreManager()
    promise.resolve(
      createFakePlayStoreStateResult(fakePlayStoreSnapshot, fakeAppUpdateManager)
    )
  }

  fun configureFakePlayStoreState(config: ReadableMap, promise: Promise) {
    resetFakePlayStoreManager()

    val availability = config.getNullableString("availability") ?: "notAvailable"
    if (availability == "available") {
      val allowedUpdateTypes = normalizeAllowedUpdateTypes(
        config.getNullableArray("allowedUpdateTypes")
      )
      val availableVersionCode = config.getNullableInt("availableVersionCode") ?: 1
      configureFakeUpdateAvailability(availableVersionCode, allowedUpdateTypes)

      val clientVersionStalenessDays =
        config.getNullableInt("clientVersionStalenessDays")
      val updatePriority = config.getNullableInt("updatePriority")
      val totalBytesToDownload = config.getNullableLong("totalBytesToDownload") ?: 0L
      val bytesDownloaded = config.getNullableLong("bytesDownloaded") ?: 0L
      val installErrorCode = config.getNullableString("installErrorCode")

      fakePlayStoreSnapshot =
        FakePlayStoreSnapshot(
          allowedUpdateTypes = allowedUpdateTypes,
          availability = "available",
          availableVersionCode = availableVersionCode,
          bytesDownloaded = bytesDownloaded,
          clientVersionStalenessDays = clientVersionStalenessDays,
          installErrorCode = installErrorCode,
          totalBytesToDownload = totalBytesToDownload,
          updatePriority = updatePriority
        )

      fakeAppUpdateManager.setClientVersionStalenessDays(clientVersionStalenessDays)

      if (updatePriority != null) {
        fakeAppUpdateManager.setUpdatePriority(updatePriority)
      }

      if (totalBytesToDownload > 0L) {
        fakeAppUpdateManager.setTotalBytesToDownload(totalBytesToDownload)
      }

      if (bytesDownloaded > 0L) {
        fakeAppUpdateManager.setBytesDownloaded(bytesDownloaded)
      }

      installErrorCode?.let {
        mapInstallErrorCode(it)?.let(fakeAppUpdateManager::setInstallErrorCode)
      }
    }

    resolveFakePlayStoreState { fakeState ->
      fakePlayStoreSnapshot = fakeState
      promise.resolve(
        createFakePlayStoreStateResult(fakePlayStoreSnapshot, fakeAppUpdateManager)
      )
    }
  }

  fun dispatchFakePlayStoreAction(action: String, promise: Promise) {
    when (action) {
      "userAcceptsUpdate" -> fakeAppUpdateManager.userAcceptsUpdate()
      "userRejectsUpdate" -> fakeAppUpdateManager.userRejectsUpdate()
      "userCancelsDownload" -> fakeAppUpdateManager.userCancelsDownload()
      "downloadStarts" -> fakeAppUpdateManager.downloadStarts()
      "downloadCompletes" -> {
        if (fakePlayStoreSnapshot.totalBytesToDownload > 0L) {
          fakePlayStoreSnapshot = fakePlayStoreSnapshot.copy(
            bytesDownloaded = fakePlayStoreSnapshot.totalBytesToDownload
          )
        }
        fakeAppUpdateManager.downloadCompletes()
      }
      "downloadFails" -> {
        fakePlayStoreSnapshot.installErrorCode?.let {
          mapInstallErrorCode(it)?.let(fakeAppUpdateManager::setInstallErrorCode)
        }
        fakeAppUpdateManager.downloadFails()
      }
      "installCompletes" -> fakeAppUpdateManager.installCompletes()
      "installFails" -> {
        fakePlayStoreSnapshot.installErrorCode?.let {
          mapInstallErrorCode(it)?.let(fakeAppUpdateManager::setInstallErrorCode)
        }
        fakeAppUpdateManager.installFails()
      }
    }

    resolveFakePlayStoreState { fakeState ->
      fakePlayStoreSnapshot = fakeState
      promise.resolve(
        createFakePlayStoreStateResult(fakePlayStoreSnapshot, fakeAppUpdateManager)
      )
    }
  }

  override fun invalidate() {
    fakeAppUpdateManager.unregisterListener(installStateUpdatedListener)
  }

  private fun configureFakeUpdateAvailability(
    availableVersionCode: Int,
    allowedUpdateTypes: List<String>
  ) {
    val uniqueAllowedUpdateTypes = allowedUpdateTypes.distinct()

    when {
      uniqueAllowedUpdateTypes.contains("flexible") &&
        uniqueAllowedUpdateTypes.contains("immediate") ->
        fakeAppUpdateManager.setUpdateAvailable(availableVersionCode)

      uniqueAllowedUpdateTypes.contains("flexible") ->
        fakeAppUpdateManager.setUpdateAvailable(
          availableVersionCode,
          AppUpdateType.FLEXIBLE
        )

      else ->
        fakeAppUpdateManager.setUpdateAvailable(
          availableVersionCode,
          AppUpdateType.IMMEDIATE
        )
    }
  }

  private fun createFakeAppUpdateManager(): FakeAppUpdateManager {
    return FakeAppUpdateManager(reactApplicationContext)
  }

  private fun ReadableMap.getNullableArray(key: String): ReadableArray? {
    return if (!hasKey(key) || isNull(key)) {
      null
    } else {
      getArray(key)
    }
  }

  private fun ReadableMap.getNullableInt(key: String): Int? {
    return if (!hasKey(key) || isNull(key)) {
      null
    } else {
      getInt(key)
    }
  }

  private fun ReadableMap.getNullableLong(key: String): Long? {
    return if (!hasKey(key) || isNull(key)) {
      null
    } else {
      getDouble(key).toLong()
    }
  }

  private fun ReadableMap.getNullableString(key: String): String? {
    return if (!hasKey(key) || isNull(key)) {
      null
    } else {
      getString(key)
    }
  }

  private fun resetFakePlayStoreManager() {
    fakeAppUpdateManager.unregisterListener(installStateUpdatedListener)
    fakeAppUpdateManager = createFakeAppUpdateManager()
    fakeAppUpdateManager.registerListener(installStateUpdatedListener)
    fakePlayStoreSnapshot = FakePlayStoreSnapshot()
  }

  private fun resolveFakePlayStoreState(
    onResolved: (FakePlayStoreSnapshot) -> Unit
  ) {
    fakeAppUpdateManager.appUpdateInfo
      .addOnSuccessListener { appUpdateInfo ->
        onResolved(
          fakePlayStoreSnapshot.copy(
            availability = mapFakeStateAvailability(appUpdateInfo)
          )
        )
      }
      .addOnFailureListener {
        onResolved(fakePlayStoreSnapshot)
      }
  }
}
