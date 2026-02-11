const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Fixes React Native hardcoding IPHONEOS_DEPLOYMENT_TARGET to 15.1 in
 * react_native_post_install (helpers.rb:min_ios_version_supported).
 *
 * Also sets DEVELOPMENT_TEAM on all targets so expo-share-intent
 * and code signing work without manual Xcode configuration.
 *
 * Config is read from app.json — single source of truth.
 *
 * See: https://github.com/expo/expo/issues/30610
 */
module.exports = function withDeploymentTarget(config, { deploymentTarget, developmentTeam }) {
  // 1. Inject post_install override into Podfile (runs AFTER react_native_post_install)
  config = withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      const snippet = [
        '',
        `    # [withDeploymentTarget] Override React Native's hardcoded 15.1`,
        `    installer.pods_project.targets.each do |target|`,
        `      target.build_configurations.each do |config|`,
        `        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${deploymentTarget}'`,
        `      end`,
        `    end`,
        `    installer.pods_project.build_configurations.each do |config|`,
        `      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${deploymentTarget}'`,
        `    end`,
      ].join('\n');

      // Insert before the `end` that closes the post_install block
      // (after react_native_post_install has fully closed)
      podfile = podfile.replace(
        /(\n  end\nend\s*$)/,
        `\n${snippet}\n  end\nend\n`
      );

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);

  // 2. Set project-level deployment target and dev team in pbxproj
  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();

    for (const key in configurations) {
      const entry = configurations[key];
      if (typeof entry !== 'object' || !entry.buildSettings) continue;

      entry.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = deploymentTarget;

      if (developmentTeam) {
        entry.buildSettings.DEVELOPMENT_TEAM = developmentTeam;
      }
    }

    return config;
  });

  return config;
};
