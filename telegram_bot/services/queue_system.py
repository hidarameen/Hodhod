"""
Queue and Worker System
Implements parallel processing with workers and task queues
"""
import asyncio
from typing import Dict, Any, Callable, Optional
from datetime import datetime
from utils.error_handler import handle_errors, ErrorLogger
from utils.database import db

error_logger = ErrorLogger("queue_system")

class QueueWorker:
    """Worker to process queue jobs"""
    
    def __init__(self, worker_id: int, handler: Callable):
        self.worker_id = worker_id
        self.handler = handler
        self.is_running = False
        self.current_job: Optional[Dict[str, Any]] = None
    
    @handle_errors("queue_worker", "process_job")
    async def process_job(self, job: Dict[str, Any]) -> bool:
        """Process a single job"""
        self.current_job = job
        job_id = job["id"]
        
        try:
            error_logger.log_info(
                f"Worker {self.worker_id} processing job {job_id}",
                {"job_type": job["type"]}
            )
            
            # Update job status to processing
            await db.update_job_status(job_id, "processing")
            
            # Execute the handler
            result = await self.handler(job)
            
            # Update job as completed
            await db.update_job_status(job_id, "completed", result=result)
            
            error_logger.log_info(f"Worker {self.worker_id} completed job {job_id}")
            return True
            
        except Exception as e:
            # Update job as failed
            await db.update_job_status(
                job_id, 
                "failed" if job["attempts"] >= job["max_attempts"] else "pending",
                error=str(e)
            )
            
            error_logger.log_warning(
                f"Worker {self.worker_id} failed job {job_id}: {str(e)}"
            )
            return False
        finally:
            self.current_job = None
    
    async def start(self):
        """Start worker loop"""
        self.is_running = True
        error_logger.log_info(f"Worker {self.worker_id} started")
    
    async def stop(self):
        """Stop worker"""
        self.is_running = False
        error_logger.log_info(f"Worker {self.worker_id} stopped")


class QueueManager:
    """Manage queue and workers"""
    
    def __init__(self, max_workers: int = 10):
        self.max_workers = max_workers
        self.workers: list[QueueWorker] = []
        self.is_running = False
        self.job_handlers: Dict[str, Callable] = {}
    
    def register_handler(self, job_type: str, handler: Callable):
        """Register handler for job type"""
        self.job_handlers[job_type] = handler
        error_logger.log_info(f"Registered handler for job type: {job_type}")
    
    @handle_errors("queue_manager", "add_job")
    async def add_job(
        self,
        job_type: str,
        payload: Dict[str, Any],
        task_id: Optional[int] = None,
        priority: int = 0
    ) -> int:
        """Add job to queue"""
        job_data = {
            "task_id": task_id,
            "type": job_type,
            "payload": payload,
            "priority": priority
        }
        
        job_id = await db.add_queue_job(job_data)
        error_logger.log_info(f"Added job {job_id} of type {job_type} to queue")
        
        return job_id
    
    @handle_errors("queue_manager", "process_queue")
    async def process_queue(self):
        """Main queue processing loop"""
        while self.is_running:
            try:
                # Get pending jobs
                jobs = await db.get_pending_jobs(limit=self.max_workers * 2)
                
                if not jobs:
                    await asyncio.sleep(1)
                    continue
                
                # Create tasks for available workers
                tasks = []
                for job in jobs[:self.max_workers]:
                    if job["type"] not in self.job_handlers:
                        error_logger.log_warning(
                            f"No handler for job type: {job['type']}"
                        )
                        continue
                    
                    handler = self.job_handlers[job["type"]]
                    worker = QueueWorker(len(self.workers) + 1, handler)
                    self.workers.append(worker)
                    
                    task = asyncio.create_task(worker.process_job(job))
                    tasks.append(task)
                
                # Wait for all tasks to complete
                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)
                
                # Clean up finished workers
                self.workers = [w for w in self.workers if w.is_running]
                
            except Exception as e:
                await error_logger.log_error("process_queue", e)
                await asyncio.sleep(5)
    
    async def start(self):
        """Start queue manager"""
        self.is_running = True
        error_logger.log_info(f"Queue manager started with {self.max_workers} max workers")
        
        # Start queue processing
        asyncio.create_task(self.process_queue())
    
    async def stop(self):
        """Stop queue manager"""
        self.is_running = False
        
        # Stop all workers
        for worker in self.workers:
            await worker.stop()
        
        error_logger.log_info("Queue manager stopped")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get queue statistics"""
        return {
            "active_workers": len([w for w in self.workers if w.is_running]),
            "total_workers": len(self.workers),
            "max_workers": self.max_workers,
            "is_running": self.is_running
        }

# Global queue manager instance
queue_manager = QueueManager(max_workers=10)
