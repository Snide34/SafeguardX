from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Optional
import asyncio
import random
from datetime import datetime

router = APIRouter()

# Data models for request/response
class LogEntry(BaseModel):
    source: str
    level: str
    message: str
    metadata: Optional[Dict] = {}

class ThreatResponse(BaseModel):
    threat_id: int
    action: str = "auto_mitigate"

# In-memory storage (replace with database)
active_threats = []
threat_history = []
system_alerts = []

class AnomalyDetector:
    """PyOD-inspired anomaly detection"""
    
    def __init__(self):
        self.risk_patterns = [
            'failed login', 'brute force', 'sql injection', 'malware', 
            'ddos', 'port scan', 'privilege escalation', 'data exfiltration'
        ]
    
    def detect_anomaly(self, log_entry: LogEntry) -> float:
        """Calculate anomaly score (0-1)"""
        score = 0.1  # Base score
        
        # Check for risk patterns
        message_lower = log_entry.message.lower()
        for pattern in self.risk_patterns:
            if pattern in message_lower:
                score += 0.3
        
        # Level-based scoring
        level_scores = {'CRITICAL': 0.4, 'ERROR': 0.3, 'WARN': 0.2, 'INFO': 0.1}
        score += level_scores.get(log_entry.level, 0.1)
        
        # Add randomness for simulation
        score += random.uniform(0, 0.2)
        
        return min(score, 1.0)
    
    def classify_threat(self, score: float, source: str) -> Dict:
        """Classify threat based on anomaly score"""
        if score > 0.9:
            return {
                'severity': 'critical',
                'category': random.choice(['APT', 'Zero-day', 'Data Breach']),
                'risk_level': 5,
                'immediate_action': True
            }
        elif score > 0.7:
            return {
                'severity': 'high', 
                'category': random.choice(['DDoS', 'Malware', 'Brute Force']),
                'risk_level': 4,
                'immediate_action': True
            }
        elif score > 0.5:
            return {
                'severity': 'medium',
                'category': random.choice(['Phishing', 'Policy Violation']),
                'risk_level': 3,
                'immediate_action': False
            }
        else:
            return {
                'severity': 'low',
                'category': 'Informational',
                'risk_level': 1,
                'immediate_action': False
            }

detector = AnomalyDetector()

@router.post("/analyze")
async def analyze_log(log_entry: LogEntry, background_tasks: BackgroundTasks):
    """Real-time log analysis with AI threat detection"""
    
    # Calculate anomaly score
    anomaly_score = detector.detect_anomaly(log_entry)
    
    # Create log record
    log_record = {
        'id': len(threat_history) + 1,
        'timestamp': datetime.now().isoformat(),
        'source': log_entry.source,
        'level': log_entry.level,
        'message': log_entry.message,
        'anomaly_score': anomaly_score,
        'metadata': log_entry.metadata
    }
    
    response_data = {
        'log_id': log_record['id'],
        'anomaly_score': anomaly_score,
        'status': 'processed'
    }
    
    # Generate threat if score is significant
    if anomaly_score > 0.6:
        threat_classification = detector.classify_threat(anomaly_score, log_entry.source)
        
        threat = {
            'id': len(active_threats) + 1,
            'log_id': log_record['id'],
            'timestamp': datetime.now().isoformat(),
            'source': log_entry.source,
            'severity': threat_classification['severity'],
            'category': threat_classification['category'],
            'confidence': round(anomaly_score * 100, 2),
            'status': 'active',
            'risk_level': threat_classification['risk_level'],
            'description': f"{threat_classification['category']} detected from {log_entry.source}"
        }
        
        active_threats.append(threat)
        threat_history.append(threat)
        
        # Create alert
        alert = {
            'id': len(system_alerts) + 1,
            'threat_id': threat['id'],
            'severity': threat['severity'],
            'message': f"🚨 {threat['category']} detected from {threat['source']}",
            'timestamp': datetime.now().isoformat(),
            'read': False,
            'actions_required': threat_classification['immediate_action']
        }
        system_alerts.append(alert)
        
        response_data.update({
            'threat_detected': True,
            'threat': threat,
            'alert': alert
        })
        
        # Trigger automated response if critical
        if threat_classification['immediate_action']:
            background_tasks.add_task(initiate_automated_response, threat['id'])
    
    return response_data

@router.get("/threats/active")
async def get_active_threats():
    """Get all active threats"""
    return {
        'threats': [t for t in active_threats if t['status'] == 'active'],
        'count': len([t for t in active_threats if t['status'] == 'active'])
    }

@router.get("/threats/history")
async def get_threat_history(limit: int = 100):
    """Get threat detection history"""
    return {
        'threats': threat_history[-limit:],
        'total': len(threat_history)
    }

@router.post("/threats/{threat_id}/respond")
async def respond_to_threat(threat_id: int, response: ThreatResponse, background_tasks: BackgroundTasks):
    """Initiate automated incident response"""
    
    threat = next((t for t in active_threats if t['id'] == threat_id), None)
    if not threat:
        raise HTTPException(status_code=404, detail="Threat not found")
    
    if threat['status'] != 'active':
        raise HTTPException(status_code=400, detail="Threat is not active")
    
    # Update threat status
    threat['status'] = 'responding'
    threat['response_initiated'] = datetime.now().isoformat()
    threat['response_type'] = response.action
    
    # Start automated response process
    background_tasks.add_task(execute_response_playbook, threat_id, response.action)
    
    return {
        'status': 'success',
        'message': f'Automated response initiated for threat {threat_id}',
        'response_type': response.action
    }

@router.get("/alerts")
async def get_alerts(unread_only: bool = False):
    """Get system security alerts"""
    if unread_only:
        alerts = [a for a in system_alerts if not a['read']]
    else:
        alerts = system_alerts
    
    return {
        'alerts': alerts,
        'unread_count': len([a for a in system_alerts if not a['read']])
    }

@router.put("/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: int):
    """Mark alert as read"""
    alert = next((a for a in system_alerts if a['id'] == alert_id), None)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert['read'] = True
    alert['read_timestamp'] = datetime.now().isoformat()
    
    return {'status': 'success', 'message': 'Alert marked as read'}

@router.get("/dashboard/metrics")
async def get_dashboard_metrics():
    """Get real-time dashboard metrics"""
    return {
        'active_threats': len([t for t in active_threats if t['status'] == 'active']),
        'total_threats_today': len([t for t in threat_history if t['timestamp'][:10] == datetime.now().date().isoformat()]),
        'unread_alerts': len([a for a in system_alerts if not a['read']]),
        'threat_levels': {
            'critical': len([t for t in active_threats if t['severity'] == 'critical' and t['status'] == 'active']),
            'high': len([t for t in active_threats if t['severity'] == 'high' and t['status'] == 'active']),
            'medium': len([t for t in active_threats if t['severity'] == 'medium' and t['status'] == 'active']),
            'low': len([t for t in active_threats if t['severity'] == 'low' and t['status'] == 'active'])
        },
        'system_status': 'operational',
        'last_updated': datetime.now().isoformat()
    }

# Background task functions
async def initiate_automated_response(threat_id: int):
    """Automated threat response simulation"""
    await asyncio.sleep(1)  # Simulate processing time
    
    threat = next((t for t in active_threats if t['id'] == threat_id), None)
    if threat:
        threat['status'] = 'mitigating'
        threat['auto_response_started'] = datetime.now().isoformat()
        
        # Simulate response actions based on threat type
        if threat['category'] in ['DDoS', 'Brute Force']:
            await block_ip_address(threat)
        elif threat['category'] in ['Malware', 'APT']:
            await isolate_system(threat)
        elif threat['category'] == 'Phishing':
            await quarantine_email(threat)
        
        # Complete response
        await asyncio.sleep(2)
        threat['status'] = 'resolved'
        threat['resolved_timestamp'] = datetime.now().isoformat()

async def execute_response_playbook(threat_id: int, action_type: str):
    """Execute specific response playbook"""
    threat = next((t for t in active_threats if t['id'] == threat_id), None)
    if not threat:
        return
    
    # Simulate playbook execution
    playbook_actions = {
        'auto_mitigate': ['Block suspicious IP', 'Isolate affected system', 'Notify security team'],
        'investigate': ['Collect forensic data', 'Analyze threat vectors', 'Generate report'],
        'contain': ['Network segmentation', 'Access restrictions', 'Monitor communications']
    }
    
    actions = playbook_actions.get(action_type, ['Default response'])
    threat['response_actions'] = actions
    threat['playbook_executed'] = action_type
    
    # Simulate execution time
    await asyncio.sleep(3)
    
    threat['status'] = 'resolved'
    threat['resolution_timestamp'] = datetime.now().isoformat()
    threat['resolution_summary'] = f"Threat resolved using {action_type} playbook"

# Helper functions for specific response types
async def block_ip_address(threat: Dict):
    await asyncio.sleep(0.5)
    threat.setdefault('response_actions', []).append('IP address blocked at firewall')

async def isolate_system(threat: Dict):
    await asyncio.sleep(0.5)
    threat.setdefault('response_actions', []).append('System isolated from network')

async def quarantine_email(threat: Dict):
    await asyncio.sleep(0.5)
    threat.setdefault('response_actions', []).append('Malicious email quarantined')