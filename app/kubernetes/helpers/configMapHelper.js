import _ from 'lodash-es';

class KubernetesConfigMapHelper {
  static parseJSONData(configMap) {
    _.forIn(configMap.Data, (value, key) => {
      try {
        configMap.Data[key] = JSON.parse(value);
      } catch (err) {
        configMap.Data[key] = value;
      }
    });
    return configMap;
  }
}
export default KubernetesConfigMapHelper;
