package com.appupdates.playstore

internal enum class PlayUpdateBackend {
  FAKE,
  REAL,
}

internal data class FakePlayStoreSnapshot(
  val allowedUpdateTypes: List<String> = emptyList(),
  val availability: String = "notAvailable",
  val availableVersionCode: Int? = null,
  val bytesDownloaded: Long = 0L,
  val clientVersionStalenessDays: Int? = null,
  val installErrorCode: String? = null,
  val totalBytesToDownload: Long = 0L,
  val updatePriority: Int? = null,
)
