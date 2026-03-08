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
                  reject:(RCTPromiseRejectBlock)reject
{
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
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  (void)flow;
  (void)resumeInProgress;

  resolve(@{
    @"outcome" : @"failed",
    @"errorCode" : @"not_supported_on_platform",
    @"message" : @"Play in-app updates are only available on Android.",
  });
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

@end
