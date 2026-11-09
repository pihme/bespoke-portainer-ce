import _ from 'lodash-es';
import angular from 'angular';
import { confirmWebEditorDiscard } from '@@/modals/confirm';

class CreateConfigController {
  /* @ngInject */
  constructor($async, $state, $transition$, $window, Notifications, ConfigService, endpoint) {
    this.$state = $state;
    this.$transition$ = $transition$;
    this.$window = $window;
    this.Notifications = Notifications;
    this.ConfigService = ConfigService;
    this.$async = $async;
    this.endpoint = endpoint;

    this.formValues = {
      Name: '',
      Labels: [],
      ConfigContent: '',
    };

    this.state = {
      formValidationError: '',
      isEditorDirty: false,
    };

    this.editorUpdate = this.editorUpdate.bind(this);
    this.createAsync = this.createAsync.bind(this);
  }

  async $onInit() {
    this.$window.onbeforeunload = () => {
      if (this.formValues.displayCodeEditor && this.formValues.ConfigContent && this.state.isEditorDirty) {
        return '';
      }
    };

    if (!this.$transition$.params().id) {
      this.formValues.displayCodeEditor = true;
      return;
    }

    try {
      let data = await this.ConfigService.config(this.endpoint.Id, this.$transition$.params().id);
      this.formValues.Name = data.Name + '_copy';
      this.formValues.ConfigContent = data.Data;
      let labels = _.keys(data.Labels);
      for (let i = 0; i < labels.length; i++) {
        let labelName = labels[i];
        let labelValue = data.Labels[labelName];
        this.formValues.Labels.push({ name: labelName, value: labelValue });
      }
      this.formValues.displayCodeEditor = true;
    } catch (err) {
      this.formValues.displayCodeEditor = true;
      this.Notifications.error('Failure', err, 'Unable to clone config');
    }
  }

  $onDestroy() {
    this.state.isEditorDirty = false;
  }

  async uiCanExit() {
    if (this.formValues.displayCodeEditor && this.formValues.ConfigContent && this.state.isEditorDirty) {
      return confirmWebEditorDiscard();
    }
  }

  addLabel() {
    this.formValues.Labels.push({ name: '', value: '' });
  }

  removeLabel(index) {
    this.formValues.Labels.splice(index, 1);
  }

  prepareLabelsConfig(config) {
    let labels = {};
    this.formValues.Labels.forEach(function (label) {
      if (label.name && label.value) {
        labels[label.name] = label.value;
      }
    });
    config.Labels = labels;
  }

  prepareConfigData(config) {
    let configData = this.formValues.ConfigContent;
    config.Data = btoa(unescape(encodeURIComponent(configData)));
  }

  prepareConfiguration() {
    let config = {};
    config.Name = this.formValues.Name;
    this.prepareConfigData(config);
    this.prepareLabelsConfig(config);
    return config;
  }

  create() {
    return this.$async(this.createAsync);
  }

  async createAsync() {
    this.state.formValidationError = '';
    if (this.formValues.ConfigContent === '') {
      this.state.formValidationError = 'Config content must not be empty';
      return;
    }

    const config = this.prepareConfiguration();

    try {
      await this.ConfigService.create(this.endpoint.Id, config);
      this.Notifications.success('Success', 'Configuration successfully created');
      this.state.isEditorDirty = false;
      this.$state.go('docker.configs', {}, { reload: true });
    } catch (err) {
      this.Notifications.error('Failure', err, 'Unable to create config');
    }
  }

  editorUpdate(value) {
    this.formValues.ConfigContent = value;
    this.state.isEditorDirty = true;
  }
}

export default CreateConfigController;
angular.module('portainer.docker').controller('CreateConfigController', CreateConfigController);
