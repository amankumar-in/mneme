Pod::Spec.new do |s|
  s.name           = 'ExpoLocalServer'
  s.version        = '1.0.0'
  s.summary        = 'Local HTTP and WebSocket server for Expo'
  s.description    = 'Provides a local network HTTP and WebSocket server for LaterBox web client feature'
  s.homepage       = 'https://github.com/laterbox'
  s.license        = 'MIT'
  s.author         = 'LaterBox'
  s.source         = { git: '' }
  s.platform       = :ios, '16.0'
  s.swift_version  = '5.9'
  s.source_files   = '**/*.swift'
  s.dependency 'ExpoModulesCore'
  s.dependency 'GCDWebServer', '~> 3.5'
  s.dependency 'GCDWebServer/WebUploader', '~> 3.5'
  s.dependency 'GCDWebServer/WebDAV', '~> 3.5'
end
