import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification } from '../../../core/services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notifications-container">
      @for (notification of notifications; track notification.id) {
        <div class="notification" 
             [class]="'notification-' + notification.type">
          <div class="notification-content">
            <div class="notification-icon">
              @switch (notification.type) {
                @case ('success') { ✅ }
                @case ('error') { ❌ }
                @case ('warning') { ⚠️ }
                @case ('info') { ℹ️ }
              }
            </div>
            <div class="notification-message">{{ notification.message }}</div>
            @if (notification.dismissible !== false) {
              <button class="notification-close" (click)="remove(notification.id)">×</button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .notifications-container {
      position: fixed;
      top: calc(var(--navbar-height, 72px) + 12px);
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 400px;
    }

    .notification {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      border-radius: var(--neu-radius-button, 16px);
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      padding: 1rem 1.25rem;
      animation: slideIn 0.3s ease-out;
      border: none;
      position: relative;
      overflow: hidden;
      transition: background 0.3s ease;
    }

    .notification:hover {
      background: var(--neu-card-bg-hover, linear-gradient(145deg, #EDF0F5, #DCE1E8));
    }

    .notification::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      border-radius: 4px 0 0 4px;
    }

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .notification-success::before { background: var(--neu-accent-secondary, #38B2AC); }
    .notification-error::before { background: var(--neu-accent-danger, #E53E3E); }
    .notification-warning::before { background: var(--neu-accent-warning, #ED8936); }
    .notification-info::before { background: var(--neu-accent, #6C63FF); }

    .notification-content {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .notification-icon {
      font-size: 1.3rem;
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      box-shadow: var(--neu-inset-sm, inset 3px 3px 6px rgba(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5));
    }

    .notification-message {
      flex: 1;
      color: var(--neu-text-primary, #3D4852);
      font-size: 0.9rem;
      line-height: 1.5;
      padding-top: 0.25rem;
    }

    .notification-close {
      background: var(--neu-bg, #E0E5EC);
      border: none;
      font-size: 1.25rem;
      color: var(--neu-text-muted, #6B7280);
      cursor: pointer;
      padding: 0;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
      transition: all var(--neu-transition, 0.3s ease-out);
      flex-shrink: 0;
    }

    .notification-close:hover {
      box-shadow: var(--neu-inset-sm);
      color: var(--neu-text-primary, #3D4852);
    }

    .notification.removing {
      animation: slideOut 0.3s ease-in forwards;
    }

    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }

    @media (max-width: 768px) {
      .notifications-container {
        top: calc(var(--navbar-height, 60px) + 8px);
        right: 12px;
        left: 12px;
        max-width: 100%;
      }
    }
  `]
})
export class NotificationsComponent implements OnInit {
  private notificationService = inject(NotificationService);

  notifications: Notification[] = [];

  ngOnInit() {
    this.notificationService.notifications$.subscribe(notifications => {
      this.notifications = notifications;
    });
  }

  remove(id: number) {
    this.notificationService.remove(id);
  }
}

