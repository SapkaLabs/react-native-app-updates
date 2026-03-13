package com.appupdates

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.content.pm.PackageInfoCompat
import com.appupdates.playstore.FakePlayStoreBackend
import com.appupdates.playstore.PlayStoreBackend
import com.appupdates.playstore.RealPlayStoreBackend
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext

class AppUpdatesModule(reactContext: ReactApplicationContext) :
  NativeAppUpdatesSpec(reactContext) {

  private val realPlayStoreBackend = RealPlayStoreBackend(reactContext)
  private val fakePlayStoreBackend = FakePlayStoreBackend(reactContext)

  private val activityEventListener: ActivityEventListener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
      ) {
        realPlayStoreBackend.onActivityResult(requestCode, resultCode, data)
      }
    }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getInstalledAppInfo(promise: Promise) {
    try {
      val packageName = reactApplicationContext.packageName
      val packageInfo =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          reactApplicationContext.packageManager.getPackageInfo(
            packageName,
            android.content.pm.PackageManager.PackageInfoFlags.of(0L)
          )
        } else {
          @Suppress("DEPRECATION")
          reactApplicationContext.packageManager.getPackageInfo(packageName, 0)
        }

      promise.resolve(
        Arguments.createMap().apply {
          putString("identifier", packageInfo.packageName)
          putString("version", packageInfo.versionName ?: "")
          putString(
            "buildNumber",
            PackageInfoCompat.getLongVersionCode(packageInfo).toString()
          )
        }
      )
    } catch (exception: Exception) {
      promise.reject("get_installed_app_info_error", exception)
    }
  }

  override fun getPlayUpdateInfo(backend: String, promise: Promise) {
    getPlayStoreBackend(backend).getPlayUpdateInfo(promise)
  }

  override fun startPlayUpdate(
    flow: String,
    resumeInProgress: Boolean,
    backend: String,
    promise: Promise
  ) {
    getPlayStoreBackend(backend).startPlayUpdate(flow, resumeInProgress, promise)
  }

  override fun getFakePlayStoreState(promise: Promise) {
    fakePlayStoreBackend.getFakePlayStoreState(promise)
  }

  override fun resetFakePlayStore(promise: Promise) {
    fakePlayStoreBackend.resetFakePlayStore(promise)
  }

  override fun configureFakePlayStoreState(config: com.facebook.react.bridge.ReadableMap, promise: Promise) {
    fakePlayStoreBackend.configureFakePlayStoreState(config, promise)
  }

  override fun dispatchFakePlayStoreAction(action: String, promise: Promise) {
    fakePlayStoreBackend.dispatchFakePlayStoreAction(action, promise)
  }

  override fun openUrl(url: String, promise: Promise) {
    try {
      val intent =
        Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
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
    reactApplicationContext.removeActivityEventListener(activityEventListener)
    realPlayStoreBackend.invalidate()
    fakePlayStoreBackend.invalidate()
    super.invalidate()
  }

  private fun createOpenUrlResult(
    opened: Boolean,
    errorCode: String?,
    message: String?
  ) =
    Arguments.createMap().apply {
      putBoolean("opened", opened)
      putString("errorCode", errorCode)
      putString("message", message)
    }

  private fun getPlayStoreBackend(backend: String): PlayStoreBackend {
    return when (backend) {
      "fake" -> fakePlayStoreBackend
      else -> realPlayStoreBackend
    }
  }

  companion object {
    const val NAME = NativeAppUpdatesSpec.NAME
  }
}
