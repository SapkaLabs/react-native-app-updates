#import "AppUpdates.h"

#import <UIKit/UIKit.h>

@implementation AppUpdates

- (void)getInstalledAppInfo:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  NSString *bundleIdentifier = [[NSBundle mainBundle] bundleIdentifier] ?: @"";
  NSString *version = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"] ?: @"";
  NSString *buildNumber = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];

  resolve(@{
    @"identifier" : bundleIdentifier,
    @"version" : version,
    @"buildNumber" : buildNumber ?: [NSNull null],
  });
}

- (void)getPlayUpdateInfo:(RCTPromiseResolveBlock)resolve
                  backend:(NSString *)backend
                  reject:(RCTPromiseRejectBlock)reject
{
  (void)backend;

  resolve(@{
    @"status" : @"error",
    @"immediateAllowed" : @NO,
    @"flexibleAllowed" : @NO,
    @"availableVersionCode" : [NSNull null],
    @"clientVersionStalenessDays" : [NSNull null],
    @"updatePriority" : [NSNull null],
    @"errorCode" : @"not_supported_on_platform",
    @"message" : @"Play in-app updates are only available on Android.",
  });
}

- (void)startPlayUpdate:(NSString *)flow
       resumeInProgress:(BOOL)resumeInProgress
                backend:(NSString *)backend
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  (void)flow;
  (void)resumeInProgress;
  (void)backend;

  resolve(@{
    @"outcome" : @"failed",
    @"errorCode" : @"not_supported_on_platform",
    @"message" : @"Play in-app updates are only available on Android.",
  });
}

- (void)getFakePlayStoreState:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  (void)reject;

  resolve([self createDefaultFakePlayStoreState]);
}

- (void)resetFakePlayStore:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  (void)reject;

  resolve([self createDefaultFakePlayStoreState]);
}

- (void)configureFakePlayStoreState:(NSDictionary *)config
                            resolve:(RCTPromiseResolveBlock)resolve
                             reject:(RCTPromiseRejectBlock)reject
{
  (void)config;
  (void)reject;

  resolve([self createDefaultFakePlayStoreState]);
}

- (void)dispatchFakePlayStoreAction:(NSString *)action
                            resolve:(RCTPromiseResolveBlock)resolve
                             reject:(RCTPromiseRejectBlock)reject
{
  (void)action;
  (void)reject;

  resolve([self createDefaultFakePlayStoreState]);
}

- (void)openUrl:(NSString *)url
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  NSURL *targetURL = [NSURL URLWithString:url];
  if (targetURL == nil) {
    resolve(@{
      @"opened" : @NO,
      @"errorCode" : @"invalid_url",
      @"message" : @"The provided URL is invalid.",
    });
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    UIApplication *application = UIApplication.sharedApplication;
    [application openURL:targetURL
                 options:@{}
       completionHandler:^(BOOL success) {
         resolve(@{
           @"opened" : @(success),
           @"errorCode" : success ? [NSNull null] : @"open_url_failed",
           @"message" : success ? [NSNull null] : @"Unable to open the provided URL.",
         });
       }];
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeAppUpdatesSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"AppUpdates";
}

- (NSDictionary *)createDefaultFakePlayStoreState
{
  return @{
    @"allowedUpdateTypes" : @[],
    @"availability" : @"notAvailable",
    @"availableVersionCode" : [NSNull null],
    @"bytesDownloaded" : @0,
    @"clientVersionStalenessDays" : [NSNull null],
    @"installErrorCode" : [NSNull null],
    @"isConfirmationDialogVisible" : @NO,
    @"isImmediateFlowVisible" : @NO,
    @"isInstallSplashScreenVisible" : @NO,
    @"totalBytesToDownload" : @0,
    @"updatePriority" : [NSNull null],
  };
}

@end
