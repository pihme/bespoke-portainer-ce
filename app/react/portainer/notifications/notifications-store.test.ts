import { notificationsStore } from './notifications-store';
import { ToastNotification } from './types';

function notif(id: string): ToastNotification {
  return { id, title: id, details: 'd', type: 'success', timeStamp: new Date() };
}

describe('notificationsStore (REQ in-app notifications)', () => {
  beforeEach(() => {
    notificationsStore.setState({ userNotifications: {} });
  });

  it('adds removes and clears user notifications', () => {
    notificationsStore.getState().addNotification(1, notif('a'));
    notificationsStore.getState().addNotification(1, notif('b'));
    expect(notificationsStore.getState().userNotifications[1]).toHaveLength(2);

    notificationsStore.getState().removeNotification(1, 'a');
    expect(notificationsStore.getState().userNotifications[1].map((n) => n.id)).toEqual(['b']);

    notificationsStore.getState().removeNotifications(1, ['b']);
    expect(notificationsStore.getState().userNotifications[1]).toEqual([]);

    notificationsStore.getState().addNotification(1, notif('c'));
    notificationsStore.getState().clearUserNotifications(1);
    expect(notificationsStore.getState().userNotifications[1]).toEqual([]);
  });
});
